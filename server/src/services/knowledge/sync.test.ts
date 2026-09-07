import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./chunk", () => ({
  chunkDocument: vi.fn(),
}));

vi.mock("./embedding", () => ({
  generateEmbeddings: vi.fn(),
}));

vi.mock("~/services/analytics/llm-usage", () => ({
  recordLlmUsage: vi.fn(async () => {}),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { chunkDocument } = await import("./chunk");
const { generateEmbeddings } = await import("./embedding");
const { recordLlmUsage } = await import("~/services/analytics/llm-usage");
const { storeMarkdownAndSync, syncAll, syncFile } = await import("./sync");

const fakeEmbedding = () => [0.1, 0.2];

const setChunks = (texts: string[], source = "doc.md") => {
  vi.mocked(chunkDocument).mockResolvedValue({
    texts,
    metadata: texts.map((content) => ({ source, content })),
  });
  vi.mocked(generateEmbeddings).mockResolvedValue({
    embeddings: texts.map(fakeEmbedding),
    tokens: texts.length * 10,
  });
};

const buildVectorize = (previousChunkCount = 0) =>
  ({
    upsert: vi.fn(async () => {}),
    getByIds: vi.fn(async () =>
      previousChunkCount > 0
        ? [
            {
              id: "x",
              values: [],
              metadata: { chunkCount: previousChunkCount },
            },
          ]
        : [],
    ),
    deleteByIds: vi.fn(async () => {}),
  }) as unknown as VectorizeIndex;

const upsertedIds = (vectorize: VectorizeIndex) => {
  const [vectors] = vi.mocked(vectorize.upsert).mock.calls[0] as [
    Array<{ id: string }>,
  ];
  return vectors.map((v) => v.id);
};

const buildR2Object = (
  key: string,
  uploadedAt: string | Date = "2030-01-01T00:00:00Z",
): R2Object =>
  ({
    key,
    uploaded: uploadedAt instanceof Date ? uploadedAt : new Date(uploadedAt),
  }) as unknown as R2Object;

const buildBucket = (
  objects: R2Object[],
  contents: Record<string, string | null>,
) =>
  ({
    list: vi.fn(async () => ({ objects })),
    get: vi.fn(async (key: string) => {
      const text = contents[key];
      if (text == null) return null;
      return { text: async () => text } as unknown as R2ObjectBody;
    }),
    put: vi.fn(async () => {}),
  }) as unknown as R2Bucket;

beforeEach(() => {
  vi.mocked(chunkDocument).mockReset();
  vi.mocked(generateEmbeddings).mockReset();
  vi.mocked(recordLlmUsage).mockClear();
  setChunks(["a".repeat(100), "b".repeat(100)]);
});

describe("syncFile", () => {
  it("チャンクごとに source とチャンク番号から決まる ID で upsert し、chunkCount を metadata に載せる", async () => {
    const vectorize = buildVectorize();

    const result = await syncFile("doc.md", "# c", { vectorize, apiKey: "k" });

    expect(result).toEqual({ chunks: 2 });
    expect(chunkDocument).toHaveBeenCalledWith("doc.md", "# c");
    const upsertArg = vi.mocked(vectorize.upsert).mock.calls[0]?.[0] as Array<{
      id: string;
      values: number[];
      metadata: Record<string, unknown>;
    }>;
    expect(upsertArg.map((v) => v.id)).toEqual([
      expect.stringMatching(/^[0-9a-f]{32}#0$/),
      expect.stringMatching(/^[0-9a-f]{32}#1$/),
    ]);
    expect(upsertArg[0].metadata).toMatchObject({
      source: "doc.md",
      chunkCount: 2,
    });
    expect(upsertArg[0].values).toEqual(fakeEmbedding());
  });

  it("同じファイルを再投入すると同じ ID になる", async () => {
    const first = buildVectorize();
    await syncFile("doc.md", "# c", { vectorize: first, apiKey: "k" });
    const second = buildVectorize(2);
    await syncFile("doc.md", "# c", { vectorize: second, apiKey: "k" });

    expect(upsertedIds(first)).toEqual(upsertedIds(second));
    expect(second.deleteByIds).not.toHaveBeenCalled();
  });

  it("チャンク数が減ったら、余った末尾の ID を upsert より前に削除する", async () => {
    const vectorize = buildVectorize(5);
    const order: string[] = [];
    vi.mocked(vectorize.deleteByIds).mockImplementation(async () => {
      order.push("delete");
      return {} as never;
    });
    vi.mocked(vectorize.upsert).mockImplementation(async () => {
      order.push("upsert");
      return {} as never;
    });

    await syncFile("doc.md", "# c", { vectorize, apiKey: "k" });

    const deleted = vi.mocked(vectorize.deleteByIds).mock.calls[0]?.[0];
    expect(deleted?.map((id) => id.split("#")[1])).toEqual(["2", "3", "4"]);
    expect(order).toEqual(["delete", "upsert"]);
  });

  it("チャンクが 0 件になったファイルは旧チャンクをすべて削除し、埋め込みを生成しない", async () => {
    setChunks([]);
    const vectorize = buildVectorize(3);

    const result = await syncFile("doc.md", "", { vectorize, apiKey: "k" });

    expect(result).toEqual({ chunks: 0 });
    expect(vi.mocked(vectorize.deleteByIds).mock.calls[0]?.[0]).toHaveLength(3);
    expect(generateEmbeddings).not.toHaveBeenCalled();
    expect(vectorize.upsert).not.toHaveBeenCalled();
  });

  it("d1 があれば embedding の usage を記録する", async () => {
    const d1 = {} as D1Database;

    await syncFile("doc.md", "# c", {
      vectorize: buildVectorize(),
      apiKey: "k",
      d1,
    });

    expect(recordLlmUsage).toHaveBeenCalledWith(d1, {
      model: expect.any(String),
      usage: { inputTokens: 20 },
      source: "embedding",
      agent: "embedding",
    });
  });

  it("途中で失敗したら error に詰めて返す", async () => {
    vi.mocked(generateEmbeddings).mockRejectedValueOnce(new Error("quota"));

    const result = await syncFile("doc.md", "# c", {
      vectorize: buildVectorize(),
      apiKey: "k",
    });

    expect(result).toEqual({ chunks: 0, error: "quota" });
  });

  it("Error 以外の throw は Unknown error にする", async () => {
    vi.mocked(generateEmbeddings).mockRejectedValueOnce("boom");

    const result = await syncFile("doc.md", "# c", {
      vectorize: buildVectorize(),
      apiKey: "k",
    });

    expect(result.error).toBe("Unknown error");
  });
});

describe("storeMarkdownAndSync", () => {
  it("R2 に text/markdown で保存してから同期する", async () => {
    const bucket = buildBucket([], {});
    const vectorize = buildVectorize();

    const result = await storeMarkdownAndSync("doc.md", "# c", {
      bucket,
      vectorize,
      apiKey: "k",
    });

    expect(bucket.put).toHaveBeenCalledWith("doc.md", "# c", {
      httpMetadata: { contentType: "text/markdown" },
    });
    expect(chunkDocument).toHaveBeenCalledWith("doc.md", "# c");
    expect(result).toEqual({ chunks: 2 });
  });
});

describe("syncAll", () => {
  const vectorize = () => buildVectorize();

  it("md ファイルが無ければ空結果", async () => {
    const result = await syncAll({
      bucket: buildBucket([], {}),
      vectorize: vectorize(),
      apiKey: "k",
    });

    expect(result).toEqual({
      results: [],
      totalFiles: 0,
      totalChunks: 0,
      editedCount: 0,
    });
  });

  it("originals/ 配下は処理対象外", async () => {
    const bucket = buildBucket(
      [buildR2Object("originals/doc.pdf"), buildR2Object("doc.md")],
      { "doc.md": "# hello" },
    );

    const result = await syncAll({
      bucket,
      vectorize: vectorize(),
      apiKey: "k",
    });

    expect(result.totalFiles).toBe(1);
    expect(chunkDocument).toHaveBeenCalledTimes(1);
    expect(chunkDocument).toHaveBeenCalledWith("doc.md", "# hello");
  });

  it("bucket.get が null を返したら error 行を記録して続行", async () => {
    const bucket = buildBucket(
      [buildR2Object("missing.md"), buildR2Object("doc.md")],
      { "missing.md": null, "doc.md": "# hello" },
    );

    const result = await syncAll({
      bucket,
      vectorize: vectorize(),
      apiKey: "k",
    });

    expect(result.results[0]).toEqual({
      file: "missing.md",
      chunks: 0,
      error: "File not found",
    });
    expect(result.results[1]).toMatchObject({ file: "doc.md", chunks: 2 });
  });

  it("originals より md が新しい場合 edited=true、閾値以内なら false", async () => {
    const base = new Date("2030-01-01T00:00:00Z");
    const bucket = buildBucket(
      [
        buildR2Object("originals/a.pdf", base),
        buildR2Object("a.md", new Date(base.getTime() + 60_000)),
        buildR2Object("originals/b.pdf", base),
        buildR2Object("b.md", new Date(base.getTime() + 1_000)),
      ],
      { "a.md": "# a", "b.md": "# b" },
    );

    const result = await syncAll({
      bucket,
      vectorize: vectorize(),
      apiKey: "k",
    });

    expect(result.results.map((r) => r.edited)).toEqual([true, false]);
    expect(result.editedCount).toBe(1);
  });

  it("複数 md を合計してチャンク数を返し、失敗したファイルの error を保持する", async () => {
    vi.mocked(generateEmbeddings)
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValueOnce({
        embeddings: [fakeEmbedding(), fakeEmbedding()],
        tokens: 20,
      });
    const bucket = buildBucket([buildR2Object("a.md"), buildR2Object("b.md")], {
      "a.md": "# a",
      "b.md": "# b",
    });

    const result = await syncAll({
      bucket,
      vectorize: vectorize(),
      apiKey: "k",
    });

    expect(result.results[0]).toMatchObject({ file: "a.md", error: "quota" });
    expect(result.results[1]).toMatchObject({ file: "b.md", chunks: 2 });
    expect(result.totalChunks).toBe(2);
  });
});

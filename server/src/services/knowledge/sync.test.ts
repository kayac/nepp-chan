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
const { syncAll, syncFile } = await import("./sync");
type R2EventMessage = import("./sync").R2EventMessage;

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

const buildR2Object = (key: string): R2Object =>
  ({ key, size: 1, etag: "e" }) as unknown as R2Object;

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

describe("syncAll", () => {
  const buildQueue = () =>
    ({ sendBatch: vi.fn(async () => {}) }) as unknown as Queue<R2EventMessage>;

  it("originals/ 以外の md ごとに PutObject 相当のメッセージを投入する", async () => {
    const bucket = buildBucket(
      [
        buildR2Object("originals/doc.pdf"),
        buildR2Object("doc.md"),
        buildR2Object("dir/other.md"),
      ],
      {},
    );
    const queue = buildQueue();

    const result = await syncAll(bucket, queue);

    expect(result).toEqual({ queued: 2 });
    const batch = vi.mocked(queue.sendBatch).mock.calls[0]?.[0] as Array<{
      body: R2EventMessage;
    }>;
    expect(batch.map((m) => m.body.object.key)).toEqual([
      "doc.md",
      "dir/other.md",
    ]);
    expect(batch[0].body.action).toBe("PutObject");
  });

  it("100 件を超えると複数バッチに分ける", async () => {
    const objects = Array.from({ length: 150 }, (_, i) =>
      buildR2Object(`f${i}.md`),
    );
    const queue = buildQueue();

    const result = await syncAll(buildBucket(objects, {}), queue);

    expect(result.queued).toBe(150);
    expect(queue.sendBatch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(queue.sendBatch).mock.calls[1]?.[0]).toHaveLength(50);
  });

  it("md が無ければ何も投入しない", async () => {
    const queue = buildQueue();

    const result = await syncAll(buildBucket([], {}), queue);

    expect(result).toEqual({ queued: 0 });
    expect(queue.sendBatch).not.toHaveBeenCalled();
  });
});

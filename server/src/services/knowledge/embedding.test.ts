import { beforeEach, describe, expect, it, vi } from "vitest";

const { mdocumentHolder } = vi.hoisted(() => ({
  mdocumentHolder: {
    chunk: vi.fn(async () => {}),
    getText: vi.fn(() => [] as string[]),
    getMetadata: vi.fn(() => [] as Record<string, unknown>[]),
  },
}));

vi.mock("@mastra/rag", () => ({
  MDocument: {
    fromMarkdown: vi.fn(() => mdocumentHolder),
  },
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => ({
    textEmbeddingModel: vi.fn(() => ({ id: "fake-embedding-model" })),
  })),
}));

vi.mock("ai", () => ({
  embedMany: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { embedMany } = await import("ai");
const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
const { processKnowledgeFile, deleteAllKnowledge, deleteKnowledgeBySource } =
  await import("./embedding");

const fakeEmbedding = (len = 1536) => new Array(len).fill(0).map((_, i) => i);

const setChunks = (
  texts: string[],
  metas: Record<string, unknown>[] = texts.map(() => ({})),
) => {
  mdocumentHolder.getText.mockReturnValue(texts);
  mdocumentHolder.getMetadata.mockReturnValue(metas);
};

const buildVectorize = () =>
  ({
    upsert: vi.fn(async () => {}),
    query: vi.fn(),
    deleteByIds: vi.fn(async () => {}),
  }) as unknown as VectorizeIndex;

beforeEach(() => {
  vi.mocked(embedMany).mockReset();
  vi.mocked(createGoogleGenerativeAI).mockClear();
  mdocumentHolder.chunk.mockClear().mockResolvedValue(undefined);
  mdocumentHolder.getText.mockReset().mockReturnValue([]);
  mdocumentHolder.getMetadata.mockReset().mockReturnValue([]);
});

describe("processKnowledgeFile", () => {
  it("chunk が 0 件なら chunks: 0 を返し embedMany を呼ばない", async () => {
    setChunks([]);
    const vectorize = buildVectorize();

    const result = await processKnowledgeFile(
      "doc.md",
      "# empty",
      vectorize,
      "key",
    );

    expect(result).toEqual({ chunks: 0 });
    expect(embedMany).not.toHaveBeenCalled();
    expect(vectorize.upsert).not.toHaveBeenCalled();
  });

  it("MIN_CHUNK_LENGTH 未満のチャンクは embedding 対象から除外する", async () => {
    setChunks(["short", "x".repeat(60)]);
    vi.mocked(embedMany).mockResolvedValueOnce({
      embeddings: [fakeEmbedding()],
    } as never);

    const vectorize = buildVectorize();
    const result = await processKnowledgeFile(
      "doc.md",
      "# c",
      vectorize,
      "key",
    );

    expect(result).toEqual({ chunks: 1 });
    expect(embedMany).toHaveBeenCalledTimes(1);
    const call = vi.mocked(embedMany).mock.calls[0]?.[0] as {
      values: string[];
    };
    expect(call.values).toHaveLength(1);
  });

  it("通常系: embedMany と vectorize.upsert を呼び chunks 数を返す", async () => {
    setChunks(
      ["a".repeat(100), "b".repeat(100)],
      [
        { title: "T1", section: "S1" },
        { title: "T1", section: "S2", subsection: "Sub" },
      ],
    );
    vi.mocked(embedMany).mockResolvedValueOnce({
      embeddings: [fakeEmbedding(), fakeEmbedding()],
    } as never);

    const vectorize = buildVectorize();
    const result = await processKnowledgeFile(
      "guide.md",
      "---\ncategory: faq\n---\n# Title\n## S1\nbody",
      vectorize,
      "key",
    );

    expect(result).toEqual({ chunks: 2 });
    expect(vectorize.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = vi.mocked(vectorize.upsert).mock.calls[0]?.[0] as Array<{
      id: string;
      values: number[];
      metadata: Record<string, unknown>;
    }>;
    expect(upsertArg).toHaveLength(2);
    expect(upsertArg[0].metadata.source).toBe("guide.md");
    expect(upsertArg[0].metadata.category).toBe("faq");
    expect(upsertArg[0].metadata.title).toBe("T1");
    expect(upsertArg[1].metadata.subsection).toBe("Sub");
  });

  it("chunk 本文の SHA-256 を contentHash として付与する", async () => {
    const bodyA = "a".repeat(100);
    setChunks([bodyA, bodyA, "b".repeat(100)], [{}, {}, {}]);
    vi.mocked(embedMany).mockResolvedValueOnce({
      embeddings: [fakeEmbedding(), fakeEmbedding(), fakeEmbedding()],
    } as never);

    const vectorize = buildVectorize();
    await processKnowledgeFile("guide.md", "x", vectorize, "key");

    const upsertArg = vi.mocked(vectorize.upsert).mock.calls[0]?.[0] as Array<{
      metadata: Record<string, unknown>;
    }>;
    const hashes = upsertArg.map((v) => v.metadata.contentHash);
    expect(hashes[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[2]).not.toBe(hashes[0]);
  });

  it("strip されたヘッダー情報を embedding テキストの先頭にプレフィックスとして復元する", async () => {
    const bodyA = "a".repeat(100);
    const bodyB = "b".repeat(100);
    setChunks(
      [bodyA, bodyB],
      [
        { title: "広報おといねっぷ 2023年6月号", section: "診療所" },
        {
          title: "広報おといねっぷ 2023年6月号",
          section: "診療所",
          subsection: "整形外科",
        },
      ],
    );
    vi.mocked(embedMany).mockResolvedValueOnce({
      embeddings: [fakeEmbedding(), fakeEmbedding()],
    } as never);

    const vectorize = buildVectorize();
    await processKnowledgeFile("kouhou.md", "x", vectorize, "key");

    const call = vi.mocked(embedMany).mock.calls[0]?.[0] as {
      values: string[];
    };
    expect(call.values[0]).toBe(
      `広報おといねっぷ 2023年6月号 > 診療所\n\n${bodyA}`,
    );
    expect(call.values[1]).toBe(
      `広報おといねっぷ 2023年6月号 > 診療所 > 整形外科\n\n${bodyB}`,
    );

    const upsertArg = vi.mocked(vectorize.upsert).mock.calls[0]?.[0] as Array<{
      metadata: Record<string, unknown>;
    }>;
    expect(upsertArg[0].metadata.content).toBe(call.values[0]);
    expect(upsertArg[1].metadata.content).toBe(call.values[1]);
  });

  it("ヘッダーメタデータがないチャンクはプレフィックスなしで元テキストを使う", async () => {
    const body = "c".repeat(100);
    setChunks([body], [{}]);
    vi.mocked(embedMany).mockResolvedValueOnce({
      embeddings: [fakeEmbedding()],
    } as never);

    const vectorize = buildVectorize();
    await processKnowledgeFile("plain.md", "x", vectorize, "key");

    const call = vi.mocked(embedMany).mock.calls[0]?.[0] as {
      values: string[];
    };
    expect(call.values[0]).toBe(body);
  });

  it("metadata から undefined を除外して upsert する", async () => {
    setChunks(["a".repeat(100)], [{ title: undefined, section: "S1" }]);
    vi.mocked(embedMany).mockResolvedValueOnce({
      embeddings: [fakeEmbedding()],
    } as never);

    const vectorize = buildVectorize();
    await processKnowledgeFile("doc.md", "x", vectorize, "key");

    const upsertArg = vi.mocked(vectorize.upsert).mock.calls[0]?.[0] as Array<{
      metadata: Record<string, unknown>;
    }>;
    expect(upsertArg[0].metadata).not.toHaveProperty("title");
    expect(upsertArg[0].metadata.section).toBe("S1");
  });

  it("Error を catch して error フィールドに詰める", async () => {
    setChunks(["a".repeat(100)]);
    vi.mocked(embedMany).mockRejectedValueOnce(new Error("rate limit"));

    const result = await processKnowledgeFile(
      "doc.md",
      "x",
      buildVectorize(),
      "key",
    );
    expect(result).toEqual({ chunks: 0, error: "rate limit" });
  });

  it("non-Error の throw は Unknown error として保持", async () => {
    setChunks(["a".repeat(100)]);
    vi.mocked(embedMany).mockRejectedValueOnce("boom");

    const result = await processKnowledgeFile(
      "doc.md",
      "x",
      buildVectorize(),
      "key",
    );
    expect(result.error).toBe("Unknown error");
  });

  it("BATCH_SIZE を超える chunk は embedMany / upsert を複数バッチに分割する", async () => {
    const total = 150;
    const texts = Array.from({ length: total }, () => "x".repeat(100));
    setChunks(texts);

    vi.mocked(embedMany)
      .mockResolvedValueOnce({
        embeddings: Array.from({ length: 100 }, fakeEmbedding),
      } as never)
      .mockResolvedValueOnce({
        embeddings: Array.from({ length: 50 }, fakeEmbedding),
      } as never);

    const vectorize = buildVectorize();
    const result = await processKnowledgeFile("big.md", "x", vectorize, "key");

    expect(result.chunks).toBe(total);
    expect(embedMany).toHaveBeenCalledTimes(2);
    expect(vectorize.upsert).toHaveBeenCalledTimes(2);
  });

  it("API キーが同じならモデルキャッシュを再利用する", async () => {
    setChunks(["a".repeat(100)]);
    vi.mocked(embedMany)
      .mockResolvedValueOnce({ embeddings: [fakeEmbedding()] } as never)
      .mockResolvedValueOnce({ embeddings: [fakeEmbedding()] } as never);

    await processKnowledgeFile("a.md", "x", buildVectorize(), "same-key");
    setChunks(["a".repeat(100)]);
    await processKnowledgeFile("b.md", "x", buildVectorize(), "same-key");

    expect(createGoogleGenerativeAI).toHaveBeenCalledTimes(1);
  });

  it("API キーが変わったらモデルを再生成する", async () => {
    setChunks(["a".repeat(100)]);
    vi.mocked(embedMany)
      .mockResolvedValueOnce({ embeddings: [fakeEmbedding()] } as never)
      .mockResolvedValueOnce({ embeddings: [fakeEmbedding()] } as never);

    await processKnowledgeFile("a.md", "x", buildVectorize(), "new-key-1");
    setChunks(["a".repeat(100)]);
    await processKnowledgeFile("b.md", "x", buildVectorize(), "new-key-2");

    expect(createGoogleGenerativeAI).toHaveBeenCalledTimes(2);
  });
});

describe("deleteAllKnowledge", () => {
  it("matches が無いと即時 break して 0 件を返す", async () => {
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({ matches: [] } as never);

    const result = await deleteAllKnowledge(vectorize);

    expect(result).toEqual({ deleted: 0 });
    expect(vectorize.deleteByIds).not.toHaveBeenCalled();
  });

  it("matches がある間ループして合計件数を返す", async () => {
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query)
      .mockResolvedValueOnce({
        matches: [{ id: "1" }, { id: "2" }],
      } as never)
      .mockResolvedValueOnce({
        matches: [{ id: "3" }],
      } as never)
      .mockResolvedValueOnce({ matches: [] } as never);

    const result = await deleteAllKnowledge(vectorize);
    expect(result.deleted).toBe(3);
    expect(vectorize.deleteByIds).toHaveBeenCalledTimes(2);
    expect(vi.mocked(vectorize.deleteByIds).mock.calls[0]?.[0]).toEqual([
      "1",
      "2",
    ]);
    expect(vi.mocked(vectorize.deleteByIds).mock.calls[1]?.[0]).toEqual(["3"]);
  });
});

describe("deleteKnowledgeBySource", () => {
  it("filter 付きで query しソース指定で削除する", async () => {
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query)
      .mockResolvedValueOnce({
        matches: [{ id: "a" }],
      } as never)
      .mockResolvedValueOnce({ matches: [] } as never);

    const result = await deleteKnowledgeBySource(vectorize, "doc.md");

    expect(result.deleted).toBe(1);
    const queryCall = vi.mocked(vectorize.query).mock.calls[0];
    expect(queryCall?.[1]).toMatchObject({
      filter: { source: { $eq: "doc.md" } },
    });
  });

  it("該当無しなら 0 件", async () => {
    const vectorize = buildVectorize();
    vi.mocked(vectorize.query).mockResolvedValueOnce({ matches: [] } as never);

    const result = await deleteKnowledgeBySource(vectorize, "ghost.md");
    expect(result.deleted).toBe(0);
  });
});

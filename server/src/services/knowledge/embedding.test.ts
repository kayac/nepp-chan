import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./chunk", () => ({
  chunkDocument: vi.fn(),
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
const { chunkDocument } = await import("./chunk");
const { processKnowledgeFile } = await import("./embedding");

const fakeEmbedding = (len = 1536) => new Array(len).fill(0).map((_, i) => i);

const setChunks = (texts: string[], source = "doc.md") => {
  vi.mocked(chunkDocument).mockResolvedValue({
    texts,
    metadata: texts.map((content) => ({ source, content })),
  });
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
  vi.mocked(chunkDocument).mockReset();
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

  it("通常系: chunk ごとに embedding を付けて upsert し chunks 数を返す", async () => {
    setChunks(["a".repeat(100), "b".repeat(100)], "guide.md");
    vi.mocked(embedMany).mockResolvedValueOnce({
      embeddings: [fakeEmbedding(), fakeEmbedding()],
    } as never);

    const vectorize = buildVectorize();
    const result = await processKnowledgeFile(
      "guide.md",
      "# Title",
      vectorize,
      "key",
    );

    expect(result).toEqual({ chunks: 2 });
    const embedCall = vi.mocked(embedMany).mock.calls[0]?.[0] as {
      values: string[];
    };
    expect(embedCall.values).toEqual(["a".repeat(100), "b".repeat(100)]);
    const upsertArg = vi.mocked(vectorize.upsert).mock.calls[0]?.[0] as Array<{
      id: string;
      values: number[];
      metadata: Record<string, unknown>;
    }>;
    expect(upsertArg).toHaveLength(2);
    expect(upsertArg[0].metadata.source).toBe("guide.md");
    expect(upsertArg[0].metadata.content).toBe("a".repeat(100));
    expect(upsertArg[0].values).toEqual(fakeEmbedding());
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

  it("100 件を超える chunk は embedMany を複数バッチに分割する", async () => {
    const total = 150;
    setChunks(Array.from({ length: total }, () => "x".repeat(100)));

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
  });

  it("API キーが同じならモデルキャッシュを再利用する", async () => {
    setChunks(["a".repeat(100)]);
    vi.mocked(embedMany)
      .mockResolvedValueOnce({ embeddings: [fakeEmbedding()] } as never)
      .mockResolvedValueOnce({ embeddings: [fakeEmbedding()] } as never);

    await processKnowledgeFile("a.md", "x", buildVectorize(), "same-key");
    await processKnowledgeFile("b.md", "x", buildVectorize(), "same-key");

    expect(createGoogleGenerativeAI).toHaveBeenCalledTimes(1);
  });

  it("API キーが変わったらモデルを再生成する", async () => {
    setChunks(["a".repeat(100)]);
    vi.mocked(embedMany)
      .mockResolvedValueOnce({ embeddings: [fakeEmbedding()] } as never)
      .mockResolvedValueOnce({ embeddings: [fakeEmbedding()] } as never);

    await processKnowledgeFile("a.md", "x", buildVectorize(), "new-key-1");
    await processKnowledgeFile("b.md", "x", buildVectorize(), "new-key-2");

    expect(createGoogleGenerativeAI).toHaveBeenCalledTimes(2);
  });
});

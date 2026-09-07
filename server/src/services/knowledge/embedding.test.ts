import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => ({
    textEmbeddingModel: vi.fn(() => ({ id: "fake-embedding-model" })),
  })),
}));

vi.mock("ai", () => ({
  embedMany: vi.fn(),
}));

const { embedMany } = await import("ai");
const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
const { generateEmbeddings } = await import("./embedding");

const fakeEmbedding = (len = 1536) => new Array(len).fill(0).map((_, i) => i);

beforeEach(() => {
  vi.mocked(embedMany).mockReset();
  vi.mocked(createGoogleGenerativeAI).mockClear();
});

describe("generateEmbeddings", () => {
  it("テキストが無ければ API を呼ばず空を返す", async () => {
    const result = await generateEmbeddings([], "key");

    expect(result).toEqual({ embeddings: [], tokens: 0 });
    expect(embedMany).not.toHaveBeenCalled();
  });

  it("100 件を超えるテキストは複数バッチに分け、トークン数を合算する", async () => {
    vi.mocked(embedMany)
      .mockResolvedValueOnce({
        embeddings: Array.from({ length: 100 }, fakeEmbedding),
        usage: { tokens: 1000 },
      } as never)
      .mockResolvedValueOnce({
        embeddings: Array.from({ length: 50 }, fakeEmbedding),
        usage: { tokens: 500 },
      } as never);

    const result = await generateEmbeddings(
      Array.from({ length: 150 }, () => "x"),
      "key",
    );

    expect(embedMany).toHaveBeenCalledTimes(2);
    expect(result.embeddings).toHaveLength(150);
    expect(result.tokens).toBe(1500);
  });

  it("API キーが同じならモデルを再利用し、変わったら再生成する", async () => {
    vi.mocked(embedMany).mockResolvedValue({
      embeddings: [fakeEmbedding()],
    } as never);

    await generateEmbeddings(["a"], "same-key");
    await generateEmbeddings(["b"], "same-key");
    expect(createGoogleGenerativeAI).toHaveBeenCalledTimes(1);

    await generateEmbeddings(["c"], "other-key");
    expect(createGoogleGenerativeAI).toHaveBeenCalledTimes(2);
  });
});

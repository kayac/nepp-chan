import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { deleteAllKnowledge, deleteKnowledgeBySource, upsertVectors } =
  await import("./vector-store");

const buildVectorize = () =>
  ({
    upsert: vi.fn(async () => {}),
    query: vi.fn(),
    deleteByIds: vi.fn(async () => {}),
  }) as unknown as VectorizeIndex;

const vector = (id: string, metadata: Record<string, unknown>) => ({
  id,
  values: [0.1],
  metadata: { source: "doc.md", content: "c", ...metadata },
});

describe("upsertVectors", () => {
  it("metadata から undefined を除外して upsert する", async () => {
    const vectorize = buildVectorize();

    await upsertVectors(vectorize, [
      vector("a", { title: undefined, section: "S1" }),
    ]);

    const arg = vi.mocked(vectorize.upsert).mock.calls[0]?.[0] as Array<{
      metadata: Record<string, unknown>;
    }>;
    expect(arg[0].metadata).not.toHaveProperty("title");
    expect(arg[0].metadata.section).toBe("S1");
  });

  it("100 件を超えると複数バッチに分ける", async () => {
    const vectorize = buildVectorize();
    const vectors = Array.from({ length: 150 }, (_, i) =>
      vector(String(i), {}),
    );

    await upsertVectors(vectorize, vectors);

    expect(vectorize.upsert).toHaveBeenCalledTimes(2);
    expect(vi.mocked(vectorize.upsert).mock.calls[1]?.[0]).toHaveLength(50);
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

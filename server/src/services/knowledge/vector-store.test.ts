import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const {
  deleteKnowledgeBySource,
  readChunkCount,
  sourceIdPrefix,
  upsertVectors,
  vectorId,
} = await import("./vector-store");

const buildVectorize = () =>
  ({
    upsert: vi.fn(async () => {}),
    query: vi.fn(),
    getByIds: vi.fn(),
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

describe("sourceIdPrefix / vectorId", () => {
  it("同じ source からは同じ ID ができ、64 バイトに収まる", async () => {
    const a = await sourceIdPrefix("villotoinep/pdf/parsed/kouhou/2025-05.md");
    const b = await sourceIdPrefix("villotoinep/pdf/parsed/kouhou/2025-05.md");
    expect(a).toBe(b);
    expect(Buffer.byteLength(vectorId(a, 99999))).toBeLessThanOrEqual(64);
  });

  it("source が違えば prefix も違う", async () => {
    expect(await sourceIdPrefix("a.md")).not.toBe(await sourceIdPrefix("b.md"));
  });
});

describe("readChunkCount", () => {
  it("先頭チャンクの metadata.chunkCount を返す", async () => {
    const vectorize = buildVectorize();
    vi.mocked(vectorize.getByIds).mockResolvedValueOnce([
      { id: "p#0", values: [], metadata: { chunkCount: 7 } },
    ] as never);

    expect(await readChunkCount(vectorize, "p")).toBe(7);
    expect(vectorize.getByIds).toHaveBeenCalledWith(["p#0"]);
  });

  it("先頭チャンクが無ければ 0", async () => {
    const vectorize = buildVectorize();
    vi.mocked(vectorize.getByIds).mockResolvedValueOnce([]);

    expect(await readChunkCount(vectorize, "p")).toBe(0);
  });
});

describe("deleteKnowledgeBySource", () => {
  it("先頭チャンクの chunkCount 分の ID を削除する", async () => {
    const vectorize = buildVectorize();
    vi.mocked(vectorize.getByIds).mockResolvedValueOnce([
      { id: "x", values: [], metadata: { chunkCount: 3 } },
    ] as never);

    const result = await deleteKnowledgeBySource(vectorize, "doc.md");

    const prefix = await sourceIdPrefix("doc.md");
    expect(vectorize.deleteByIds).toHaveBeenCalledWith([
      `${prefix}#0`,
      `${prefix}#1`,
      `${prefix}#2`,
    ]);
    expect(result).toEqual({ deleted: 3 });
  });

  it("登録が無ければ何も削除しない", async () => {
    const vectorize = buildVectorize();
    vi.mocked(vectorize.getByIds).mockResolvedValueOnce([]);

    const result = await deleteKnowledgeBySource(vectorize, "ghost.md");

    expect(vectorize.deleteByIds).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: 0 });
  });
});

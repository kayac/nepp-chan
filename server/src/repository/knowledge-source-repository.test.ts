import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";

const { testDbHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
}));

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return {
    ...actual,
    createDb: () => testDbHolder.db,
  };
});

const { knowledgeSourceRepository } = await import(
  "./knowledge-source-repository"
);

const d1 = {} as D1Database;

const baseSource = {
  sourcePath: "bus/index.md",
  approvalStatus: "pending",
  createdAt: "2026-09-01T00:00:00.000Z",
};

describe("knowledgeSourceRepository", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  it("insert と findByPath で登録内容を往復できる", async () => {
    await knowledgeSourceRepository.insert(d1, {
      ...baseSource,
      canonicalUrl: "https://example.com/bus",
      sourceAuthority: 1,
    });

    const found = await knowledgeSourceRepository.findByPath(
      d1,
      "bus/index.md",
    );
    expect(found).toMatchObject({
      sourcePath: "bus/index.md",
      canonicalUrl: "https://example.com/bus",
      sourceAuthority: 1,
      approvalStatus: "pending",
      chunkCount: 0,
    });
  });

  it("存在しない source_path は null を返す", async () => {
    expect(
      await knowledgeSourceRepository.findByPath(d1, "missing.md"),
    ).toBeNull();
  });

  it("list は source_path 昇順で全件返す", async () => {
    await knowledgeSourceRepository.insert(d1, {
      ...baseSource,
      sourcePath: "b.md",
    });
    await knowledgeSourceRepository.insert(d1, {
      ...baseSource,
      sourcePath: "a.md",
    });

    const rows = await knowledgeSourceRepository.list(d1);
    expect(rows.map((r) => r.sourcePath)).toEqual(["a.md", "b.md"]);
  });

  it("update はメタデータと updatedAt だけ更新する", async () => {
    await knowledgeSourceRepository.insert(d1, baseSource);

    await knowledgeSourceRepository.update(d1, "bus/index.md", {
      sourceHash: "hash-2",
      r2Etag: "etag-2",
    });

    const found = await knowledgeSourceRepository.findByPath(
      d1,
      "bus/index.md",
    );
    expect(found).toMatchObject({
      sourceHash: "hash-2",
      r2Etag: "etag-2",
      approvalStatus: "pending",
    });
    expect(found?.updatedAt).not.toBeNull();
  });

  it("update は承認情報を更新する", async () => {
    await knowledgeSourceRepository.insert(d1, baseSource);

    await knowledgeSourceRepository.update(d1, "bus/index.md", {
      approvalStatus: "approved",
      approvedBy: "admin-1",
      approvedAt: "2026-09-02T00:00:00.000Z",
    });

    const found = await knowledgeSourceRepository.findByPath(
      d1,
      "bus/index.md",
    );
    expect(found).toMatchObject({
      approvalStatus: "approved",
      approvedBy: "admin-1",
      approvedAt: "2026-09-02T00:00:00.000Z",
    });
  });

  it("markIndexed は chunk_count と indexed_at を更新する", async () => {
    await knowledgeSourceRepository.insert(d1, baseSource);

    await knowledgeSourceRepository.markIndexed(d1, "bus/index.md", 12);

    const found = await knowledgeSourceRepository.findByPath(
      d1,
      "bus/index.md",
    );
    expect(found?.chunkCount).toBe(12);
    expect(found?.indexedAt).not.toBeNull();
  });

  it("markRemoved は chunk_count を 0 に戻し indexed_at を消す", async () => {
    await knowledgeSourceRepository.insert(d1, baseSource);
    await knowledgeSourceRepository.markIndexed(d1, "bus/index.md", 12);

    await knowledgeSourceRepository.markRemoved(d1, "bus/index.md");

    const found = await knowledgeSourceRepository.findByPath(
      d1,
      "bus/index.md",
    );
    expect(found?.chunkCount).toBe(0);
    expect(found?.indexedAt).toBeNull();
  });
});

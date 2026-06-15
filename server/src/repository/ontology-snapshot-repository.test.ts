import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { ontologySnapshots } from "~/db";

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

const { ontologySnapshotRepository } = await import(
  "./ontology-snapshot-repository"
);

const d1 = {} as D1Database;

const sample = (
  overrides: Partial<{
    dataJson: string;
    entityCount: number;
    generatedBy: string;
  }> = {},
) => ({
  id: "latest",
  dataJson: overrides.dataJson ?? JSON.stringify({ entities: [], links: [] }),
  entityCount: overrides.entityCount ?? 0,
  generatedAt: "2026-06-15T00:00:00.000Z",
  generatedBy: overrides.generatedBy ?? "admin-1",
});

describe("ontologySnapshotRepository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("getLatest: 未保存なら undefined", async () => {
    expect(await ontologySnapshotRepository.getLatest(d1)).toBeUndefined();
  });

  it("upsert: 再実行は最新 1 件に上書きされる", async () => {
    await ontologySnapshotRepository.upsert(d1, sample({ entityCount: 1 }));
    await ontologySnapshotRepository.upsert(
      d1,
      sample({ entityCount: 5, generatedBy: "admin-2" }),
    );

    const rows = await db.select().from(ontologySnapshots).all();
    expect(rows).toHaveLength(1);

    const latest = await ontologySnapshotRepository.getLatest(d1);
    expect(latest?.entityCount).toBe(5);
    expect(latest?.generatedBy).toBe("admin-2");
  });
});

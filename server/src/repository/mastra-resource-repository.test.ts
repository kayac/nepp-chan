import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { mastraResources } from "~/db";

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

const { mastraResourceRepository } = await import(
  "./mastra-resource-repository"
);

const d1 = {} as D1Database;

describe("mastraResourceRepository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  describe("deleteUpdatedBefore", () => {
    it("更新時刻が期限より前のリソースを削除する", async () => {
      await db
        .insert(mastraResources)
        .values({ id: "r-old", updatedAt: "2026-01-01T00:00:00.000Z" });
      await db
        .insert(mastraResources)
        .values({ id: "r-new", updatedAt: "2026-06-01T00:00:00.000Z" });

      const deleted = await mastraResourceRepository.deleteUpdatedBefore(
        d1,
        "2026-03-01T00:00:00.000Z",
      );

      expect(deleted).toBe(1);
      const rows = await db.select().from(mastraResources).all();
      expect(rows.map((r) => r.id)).toEqual(["r-new"]);
    });
  });
});

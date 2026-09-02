import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { mastraMessages, mastraThreads } from "~/db";

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

const { mastraThreadRepository } = await import("./mastra-thread-repository");

const d1 = {} as D1Database;

const insertThread = async (
  db: TestDb,
  id: string,
  resourceId: string | null,
) => {
  await db
    .insert(mastraThreads)
    .values({ id, resourceId, createdAt: "2026-06-01T00:00:00.000Z" });
};

describe("mastraThreadRepository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  describe("findAll", () => {
    it("id の降順で返す", async () => {
      await insertThread(db, "t-1", "web:a");
      await insertThread(db, "t-3", "web:c");
      await insertThread(db, "t-2", "web:b");

      const rows = await mastraThreadRepository.findAll(d1);

      expect(rows.map((r) => r.id)).toEqual(["t-3", "t-2", "t-1"]);
    });

    it("resourceId が無いスレッドも返す", async () => {
      await insertThread(db, "t-1", null);

      const rows = await mastraThreadRepository.findAll(d1);

      expect(rows).toEqual([{ id: "t-1", resourceId: null }]);
    });
  });

  describe("findById", () => {
    it("見つからなければ null を返す", async () => {
      expect(await mastraThreadRepository.findById(d1, "none")).toBeNull();
    });

    it("id と resourceId を返す", async () => {
      await insertThread(db, "t-1", "line:abc");

      expect(await mastraThreadRepository.findById(d1, "t-1")).toEqual({
        id: "t-1",
        resourceId: "line:abc",
      });
    });
  });

  describe("deleteEmptyCreatedBefore", () => {
    const insertMessage = async (threadId: string) => {
      await db.insert(mastraMessages).values({
        id: `m-${threadId}`,
        threadId,
        role: "user",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    };

    const insertThreadAt = async (id: string, createdAt: string) => {
      await db
        .insert(mastraThreads)
        .values({ id, resourceId: "web:a", createdAt });
    };

    it("メッセージが残っているスレッドは期限を過ぎても消さない", async () => {
      await insertThreadAt("t-1", "2026-01-01T00:00:00.000Z");
      await insertMessage("t-1");

      const deleted = await mastraThreadRepository.deleteEmptyCreatedBefore(
        d1,
        "2026-03-01T00:00:00.000Z",
      );

      expect(deleted).toBe(0);
    });

    it("期限内に作られた空スレッドは消さない", async () => {
      await insertThreadAt("t-1", "2026-06-01T00:00:00.000Z");

      const deleted = await mastraThreadRepository.deleteEmptyCreatedBefore(
        d1,
        "2026-03-01T00:00:00.000Z",
      );

      expect(deleted).toBe(0);
    });

    it("期限を過ぎた空スレッドを削除する", async () => {
      await insertThreadAt("t-1", "2026-01-01T00:00:00.000Z");

      const deleted = await mastraThreadRepository.deleteEmptyCreatedBefore(
        d1,
        "2026-03-01T00:00:00.000Z",
      );

      expect(deleted).toBe(1);
      expect(await db.select().from(mastraThreads).all()).toHaveLength(0);
    });
  });
});

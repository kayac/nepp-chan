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

const { mastraMessages, mastraThreads } = await import("~/db");
const { threadPersonaStatusRepository } = await import(
  "./thread-persona-status-repository"
);

const fakeD1 = {} as D1Database;

describe("threadPersonaStatusRepository", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  describe("upsert", () => {
    it("初回は INSERT", async () => {
      await threadPersonaStatusRepository.upsert(fakeD1, {
        threadId: "t-1",
        lastExtractedAt: "2025-01-01T00:00:00Z",
        lastMessageCount: 5,
      });

      const found = await threadPersonaStatusRepository.findByThreadId(
        fakeD1,
        "t-1",
      );
      expect(found).toMatchObject({
        threadId: "t-1",
        lastMessageCount: 5,
      });
    });

    it("2 回目は同じ threadId で UPDATE", async () => {
      await threadPersonaStatusRepository.upsert(fakeD1, {
        threadId: "t-1",
        lastExtractedAt: "2025-01-01T00:00:00Z",
        lastMessageCount: 5,
      });
      await threadPersonaStatusRepository.upsert(fakeD1, {
        threadId: "t-1",
        lastExtractedAt: "2025-01-02T00:00:00Z",
        lastMessageCount: 12,
      });

      const found = await threadPersonaStatusRepository.findByThreadId(
        fakeD1,
        "t-1",
      );
      expect(found).toMatchObject({
        lastExtractedAt: "2025-01-02T00:00:00Z",
        lastMessageCount: 12,
      });
      const all = await threadPersonaStatusRepository.findAll(fakeD1);
      expect(all).toHaveLength(1);
    });
  });

  describe("findByThreadId", () => {
    it("該当なしは null", async () => {
      const result = await threadPersonaStatusRepository.findByThreadId(
        fakeD1,
        "ghost",
      );
      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("全件取得", async () => {
      await threadPersonaStatusRepository.upsert(fakeD1, {
        threadId: "t-1",
        lastExtractedAt: "2025-01-01T00:00:00Z",
        lastMessageCount: 1,
      });
      await threadPersonaStatusRepository.upsert(fakeD1, {
        threadId: "t-2",
        lastExtractedAt: "2025-01-01T00:00:00Z",
        lastMessageCount: 2,
      });

      const all = await threadPersonaStatusRepository.findAll(fakeD1);

      expect(all).toHaveLength(2);
    });
  });

  describe("delete", () => {
    it("対象のみ削除（他は残る）", async () => {
      await threadPersonaStatusRepository.upsert(fakeD1, {
        threadId: "t-1",
        lastExtractedAt: "2025-01-01T00:00:00Z",
        lastMessageCount: 1,
      });
      await threadPersonaStatusRepository.upsert(fakeD1, {
        threadId: "t-2",
        lastExtractedAt: "2025-01-01T00:00:00Z",
        lastMessageCount: 2,
      });

      await threadPersonaStatusRepository.delete(fakeD1, "t-1");

      const all = await threadPersonaStatusRepository.findAll(fakeD1);
      expect(all.map((r) => r.threadId)).toEqual(["t-2"]);
    });

    it("冪等: 存在しない threadId の削除は 0 件を返す", async () => {
      await expect(
        threadPersonaStatusRepository.delete(fakeD1, "ghost"),
      ).resolves.toBe(0);
    });
  });

  describe("syncMessageCounts", () => {
    it("残っているメッセージ数で処理済み件数を再計算する", async () => {
      await threadPersonaStatusRepository.upsert(fakeD1, {
        threadId: "t-1",
        lastExtractedAt: "2025-01-01T00:00:00Z",
        lastMessageCount: 10,
      });
      const db = testDbHolder.db;
      if (!db) throw new Error("test db is not initialized");
      await db.insert(mastraMessages).values({
        id: "m-1",
        threadId: "t-1",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
      });

      await threadPersonaStatusRepository.syncMessageCounts(fakeD1);

      const found = await threadPersonaStatusRepository.findByThreadId(
        fakeD1,
        "t-1",
      );
      expect(found?.lastMessageCount).toBe(1);
    });

    it("メッセージが残っていなければ 0 にする", async () => {
      await threadPersonaStatusRepository.upsert(fakeD1, {
        threadId: "t-1",
        lastExtractedAt: "2025-01-01T00:00:00Z",
        lastMessageCount: 10,
      });

      await threadPersonaStatusRepository.syncMessageCounts(fakeD1);

      const found = await threadPersonaStatusRepository.findByThreadId(
        fakeD1,
        "t-1",
      );
      expect(found?.lastMessageCount).toBe(0);
    });
  });

  describe("deleteOrphaned", () => {
    it("スレッドが消えた状態だけを削除する", async () => {
      const db = testDbHolder.db;
      if (!db) throw new Error("test db is not initialized");
      await db.insert(mastraThreads).values({
        id: "t-alive",
        resourceId: "web:a",
        createdAt: "2025-01-01T00:00:00Z",
      });
      for (const threadId of ["t-alive", "t-gone"]) {
        await threadPersonaStatusRepository.upsert(fakeD1, {
          threadId,
          lastExtractedAt: "2025-01-01T00:00:00Z",
          lastMessageCount: 1,
        });
      }

      const deleted =
        await threadPersonaStatusRepository.deleteOrphaned(fakeD1);

      expect(deleted).toBe(1);
      expect(
        await threadPersonaStatusRepository.findByThreadId(fakeD1, "t-alive"),
      ).not.toBeNull();
      expect(
        await threadPersonaStatusRepository.findByThreadId(fakeD1, "t-gone"),
      ).toBeNull();
    });
  });
});

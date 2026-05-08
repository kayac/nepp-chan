import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "../test-helpers/test-db";

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

    it("冪等: 存在しない threadId の削除はエラーにならない", async () => {
      await expect(
        threadPersonaStatusRepository.delete(fakeD1, "ghost"),
      ).resolves.toBeUndefined();
    });
  });
});

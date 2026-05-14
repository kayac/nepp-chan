import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "~/__tests__/helpers/assert-defined";
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

const { feedbackRepository } = await import("./feedback-repository");

const fakeD1 = {} as D1Database;

const conversationContext = JSON.stringify({
  previousMessages: [],
  targetMessage: {
    id: "m-1",
    role: "assistant",
    content: "ねっぷちゃんの返事",
  },
  nextMessages: [],
});

type CreateOverrides = {
  id?: string;
  threadId?: string;
  messageId?: string;
  rating?: "good" | "bad" | "idea";
  category?: string | null;
  comment?: string | null;
  conversationContext?: string;
  toolExecutions?: string | null;
  createdAt?: string;
};

const baseInput = (overrides: CreateOverrides = {}) => ({
  id: overrides.id ?? "f-1",
  threadId: overrides.threadId ?? "t-1",
  messageId: overrides.messageId ?? "m-1",
  rating: overrides.rating ?? "good",
  category: "category" in overrides ? (overrides.category ?? null) : "accuracy",
  comment: "comment" in overrides ? (overrides.comment ?? null) : "コメント",
  conversationContext: overrides.conversationContext ?? conversationContext,
  toolExecutions:
    "toolExecutions" in overrides ? (overrides.toolExecutions ?? null) : null,
  createdAt: overrides.createdAt ?? "2030-01-01T00:00:00Z",
});

describe("feedbackRepository", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  describe("create", () => {
    it("入力した id を返し、レコードを挿入する", async () => {
      const id = await feedbackRepository.create(fakeD1, baseInput());
      expect(id).toBe("f-1");

      const found = await feedbackRepository.findById(fakeD1, "f-1");
      expect(found).toMatchObject({
        id: "f-1",
        threadId: "t-1",
        rating: "good",
        category: "accuracy",
        comment: "コメント",
      });
    });

    it("category / comment / toolExecutions 未指定なら null", async () => {
      await feedbackRepository.create(fakeD1, {
        id: "f-min",
        threadId: "t-1",
        messageId: "m-1",
        rating: "bad",
        conversationContext,
        createdAt: "2030-01-01T00:00:00Z",
      });
      const found = await feedbackRepository.findById(fakeD1, "f-min");
      expect(found?.category).toBeNull();
      expect(found?.comment).toBeNull();
      expect(found?.toolExecutions).toBeNull();
    });
  });

  describe("findById", () => {
    it("存在しなければ null", async () => {
      expect(await feedbackRepository.findById(fakeD1, "ghost")).toBeNull();
    });
  });

  describe("list", () => {
    const seed = async () => {
      for (let i = 0; i < 5; i++) {
        await feedbackRepository.create(
          fakeD1,
          baseInput({
            id: `f-${i}`,
            rating: i % 2 === 0 ? "good" : "bad",
            createdAt: `2030-01-0${i + 1}T00:00:00Z`,
          }),
        );
      }
    };

    it("デフォルトは createdAt 降順で最大 30 件", async () => {
      await seed();
      const result = await feedbackRepository.list(fakeD1);
      expect(result.feedbacks).toHaveLength(5);
      expect(result.feedbacks[0].id).toBe("f-4");
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("limit + 1 件以上あるなら hasMore=true / nextCursor あり", async () => {
      await seed();
      const result = await feedbackRepository.list(fakeD1, { limit: 2 });
      expect(result.feedbacks).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe(result.feedbacks[1].createdAt);
    });

    it("cursor 指定で createdAt < cursor のものを取得", async () => {
      await seed();
      const result = await feedbackRepository.list(fakeD1, {
        cursor: "2030-01-03T00:00:00Z",
      });
      const ids = result.feedbacks.map((f) => f.id);
      expect(ids).toEqual(["f-1", "f-0"]);
    });

    it("rating フィルタが効く", async () => {
      await seed();
      const result = await feedbackRepository.list(fakeD1, { rating: "good" });
      const ratings = result.feedbacks.map((f) => f.rating);
      expect(ratings.every((r) => r === "good")).toBe(true);
    });

    it("該当 0 件なら空配列 + hasMore=false", async () => {
      const result = await feedbackRepository.list(fakeD1);
      expect(result.feedbacks).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe("getStats", () => {
    it("空のときは全部 0", async () => {
      const stats = await feedbackRepository.getStats(fakeD1);
      expect(stats).toEqual({
        total: 0,
        good: 0,
        bad: 0,
        idea: 0,
        byCategory: {},
      });
    });

    it("good / bad / idea を rating ごとにカウント", async () => {
      await feedbackRepository.create(
        fakeD1,
        baseInput({ id: "f-1", rating: "good" }),
      );
      await feedbackRepository.create(
        fakeD1,
        baseInput({ id: "f-2", rating: "good" }),
      );
      await feedbackRepository.create(
        fakeD1,
        baseInput({ id: "f-3", rating: "bad" }),
      );
      await feedbackRepository.create(
        fakeD1,
        baseInput({ id: "f-4", rating: "idea" }),
      );

      const stats = await feedbackRepository.getStats(fakeD1);
      expect(stats.total).toBe(4);
      expect(stats.good).toBe(2);
      expect(stats.bad).toBe(1);
      expect(stats.idea).toBe(1);
    });

    it("byCategory: null は無視、それ以外を集計", async () => {
      await feedbackRepository.create(
        fakeD1,
        baseInput({ id: "f-1", category: "accuracy" }),
      );
      await feedbackRepository.create(
        fakeD1,
        baseInput({ id: "f-2", category: "accuracy" }),
      );
      await feedbackRepository.create(
        fakeD1,
        baseInput({ id: "f-3", category: "tone" }),
      );
      await feedbackRepository.create(
        fakeD1,
        baseInput({ id: "f-4", category: null }),
      );

      const stats = await feedbackRepository.getStats(fakeD1);
      expect(stats.byCategory).toEqual({ accuracy: 2, tone: 1 });
    });
  });

  describe("count", () => {
    it("0 件なら 0", async () => {
      expect(await feedbackRepository.count(fakeD1)).toBe(0);
    });

    it("レコード数を返す", async () => {
      await feedbackRepository.create(fakeD1, baseInput({ id: "f-1" }));
      await feedbackRepository.create(fakeD1, baseInput({ id: "f-2" }));
      expect(await feedbackRepository.count(fakeD1)).toBe(2);
    });
  });

  describe("deleteByThreadId", () => {
    it("該当 threadId の全レコードを削除する", async () => {
      await feedbackRepository.create(
        fakeD1,
        baseInput({ id: "f-1", threadId: "t-A" }),
      );
      await feedbackRepository.create(
        fakeD1,
        baseInput({ id: "f-2", threadId: "t-A" }),
      );
      await feedbackRepository.create(
        fakeD1,
        baseInput({ id: "f-3", threadId: "t-B" }),
      );

      await feedbackRepository.deleteByThreadId(fakeD1, "t-A");

      const remaining = await feedbackRepository.count(fakeD1);
      expect(remaining).toBe(1);
      expect(await feedbackRepository.findById(fakeD1, "f-3")).not.toBeNull();
    });

    it("該当が無くてもエラーにならない", async () => {
      await expect(
        feedbackRepository.deleteByThreadId(fakeD1, "ghost"),
      ).resolves.toBeUndefined();
    });
  });

  describe("delete", () => {
    it("該当 id のみ削除", async () => {
      await feedbackRepository.create(fakeD1, baseInput({ id: "f-1" }));
      await feedbackRepository.create(fakeD1, baseInput({ id: "f-2" }));

      await feedbackRepository.delete(fakeD1, "f-1");

      expect(await feedbackRepository.findById(fakeD1, "f-1")).toBeNull();
      expect(await feedbackRepository.findById(fakeD1, "f-2")).not.toBeNull();
    });
  });

  describe("deleteAll", () => {
    it("全レコードを削除", async () => {
      await feedbackRepository.create(fakeD1, baseInput({ id: "f-1" }));
      await feedbackRepository.create(fakeD1, baseInput({ id: "f-2" }));

      await feedbackRepository.deleteAll(fakeD1);

      expect(await feedbackRepository.count(fakeD1)).toBe(0);
    });
  });

  describe("resolve / unresolve", () => {
    beforeEach(async () => {
      await feedbackRepository.create(fakeD1, baseInput({ id: "f-1" }));
    });

    it("resolve で resolvedAt が ISO 文字列で入る", async () => {
      const before = Date.now();
      await feedbackRepository.resolve(fakeD1, "f-1");
      const after = Date.now();

      const found = await feedbackRepository.findById(fakeD1, "f-1");
      assertDefined(found);
      assertDefined(found.resolvedAt);
      const ms = new Date(found.resolvedAt).getTime();
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(after);
    });

    it("unresolve で resolvedAt が null に戻る", async () => {
      await feedbackRepository.resolve(fakeD1, "f-1");
      await feedbackRepository.unresolve(fakeD1, "f-1");

      const found = await feedbackRepository.findById(fakeD1, "f-1");
      expect(found?.resolvedAt).toBeNull();
    });
  });
});

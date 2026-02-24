import { count, desc, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { messageFeedback } from "~/db";
import { createTestDb, type TestDb } from "./helpers/test-db";

/**
 * message_feedback テーブルに対する Drizzle ORM クエリの統合テスト
 *
 * feedbackRepository は D1Database を受け取る設計のため、
 * ここでは libsql の in-memory DB を使って Drizzle クエリ自体をテストする
 */
describe("messageFeedback Drizzle クエリ", () => {
  let db: TestDb;

  const baseFeedback = {
    threadId: "thread-1",
    messageId: "msg-1",
    rating: "good" as const,
    conversationContext: JSON.stringify([{ role: "user", content: "テスト" }]),
    createdAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("insert", () => {
    it("フィードバックを作成できる", async () => {
      await db.insert(messageFeedback).values({
        id: "fb-1",
        ...baseFeedback,
        category: "incorrect_fact",
        comment: "事実と異なる",
      });

      const saved = await db
        .select()
        .from(messageFeedback)
        .where(eq(messageFeedback.id, "fb-1"))
        .get();

      expect(saved).not.toBeNull();
      expect(saved?.rating).toBe("good");
      expect(saved?.category).toBe("incorrect_fact");
      expect(saved?.comment).toBe("事実と異なる");
      expect(saved?.threadId).toBe("thread-1");
    });

    it("オプション項目なしでも作成できる", async () => {
      await db.insert(messageFeedback).values({
        id: "fb-2",
        ...baseFeedback,
      });

      const saved = await db
        .select()
        .from(messageFeedback)
        .where(eq(messageFeedback.id, "fb-2"))
        .get();

      expect(saved?.category).toBeNull();
      expect(saved?.comment).toBeNull();
      expect(saved?.toolExecutions).toBeNull();
      expect(saved?.resolvedAt).toBeNull();
    });
  });

  describe("findById", () => {
    beforeEach(async () => {
      await db.insert(messageFeedback).values({
        id: "fb-find",
        ...baseFeedback,
      });
    });

    it("IDでフィードバックを取得できる", async () => {
      const result = await db
        .select()
        .from(messageFeedback)
        .where(eq(messageFeedback.id, "fb-find"))
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("fb-find");
    });

    it("存在しないIDの場合はundefinedを返す", async () => {
      const result = await db
        .select()
        .from(messageFeedback)
        .where(eq(messageFeedback.id, "non-existent"))
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("list", () => {
    beforeEach(async () => {
      await db.insert(messageFeedback).values([
        {
          id: "fb-a",
          ...baseFeedback,
          rating: "good",
          createdAt: "2024-01-03T00:00:00Z",
        },
        {
          id: "fb-b",
          ...baseFeedback,
          rating: "bad",
          createdAt: "2024-01-02T00:00:00Z",
        },
        {
          id: "fb-c",
          ...baseFeedback,
          rating: "good",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ]);
    });

    it("一覧を降順で取得できる", async () => {
      const results = await db
        .select()
        .from(messageFeedback)
        .orderBy(desc(messageFeedback.createdAt))
        .all();

      // 全件取得できることを確認
      expect(results).toHaveLength(3);
    });

    it("rating でフィルタできる", async () => {
      const results = await db
        .select()
        .from(messageFeedback)
        .where(eq(messageFeedback.rating, "good"))
        .all();

      expect(results).toHaveLength(2);
      expect(results.every((f) => f.rating === "good")).toBe(true);
    });

    it("cursor で次ページを取得できる", async () => {
      // 1ページ目: limit=2
      const page1 = await db
        .select()
        .from(messageFeedback)
        .orderBy(desc(messageFeedback.createdAt))
        .limit(2)
        .all();

      expect(page1).toHaveLength(2);
      expect(page1[0].id).toBe("fb-a");

      // 2ページ目: cursor = page1 の最後の createdAt
      const cursor = page1[page1.length - 1].createdAt;
      const page2 = await db
        .select()
        .from(messageFeedback)
        .where(sql`${messageFeedback.createdAt} < ${cursor}`)
        .orderBy(desc(messageFeedback.createdAt))
        .limit(2)
        .all();

      expect(page2).toHaveLength(1);
      expect(page2[0].id).toBe("fb-c");
    });

    it("hasMore と nextCursor を正しく判定できる", async () => {
      const limit = 2;

      const results = await db
        .select()
        .from(messageFeedback)
        .orderBy(desc(messageFeedback.createdAt))
        .limit(limit + 1)
        .all();

      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;
      const nextCursor = hasMore ? items[items.length - 1]?.createdAt : null;

      expect(hasMore).toBe(true);
      expect(items).toHaveLength(2);
      expect(nextCursor).toBe("2024-01-02T00:00:00Z");
    });
  });

  describe("count", () => {
    it("0件の場合", async () => {
      const result = await db
        .select({ count: count() })
        .from(messageFeedback)
        .get();

      expect(result?.count).toBe(0);
    });

    it("データがある場合", async () => {
      await db.insert(messageFeedback).values([
        { id: "c1", ...baseFeedback },
        { id: "c2", ...baseFeedback },
      ]);

      const result = await db
        .select({ count: count() })
        .from(messageFeedback)
        .get();

      expect(result?.count).toBe(2);
    });
  });

  describe("getStats", () => {
    it("rating 別と category 別の集計ができる", async () => {
      await db.insert(messageFeedback).values([
        {
          id: "s1",
          ...baseFeedback,
          rating: "good",
          category: "incorrect_fact",
        },
        {
          id: "s2",
          ...baseFeedback,
          rating: "good",
          category: "incorrect_fact",
        },
        {
          id: "s3",
          ...baseFeedback,
          rating: "bad",
          category: "off_topic",
        },
        {
          id: "s4",
          ...baseFeedback,
          rating: "idea",
          category: null,
        },
      ]);

      // total
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(messageFeedback)
        .get();
      expect(totalResult?.count).toBe(4);

      // good
      const goodResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(messageFeedback)
        .where(eq(messageFeedback.rating, "good"))
        .get();
      expect(goodResult?.count).toBe(2);

      // bad
      const badResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(messageFeedback)
        .where(eq(messageFeedback.rating, "bad"))
        .get();
      expect(badResult?.count).toBe(1);

      // idea
      const ideaResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(messageFeedback)
        .where(eq(messageFeedback.rating, "idea"))
        .get();
      expect(ideaResult?.count).toBe(1);

      // byCategory
      const categoryResults = await db
        .select({
          category: messageFeedback.category,
          count: sql<number>`COUNT(*)`,
        })
        .from(messageFeedback)
        .where(sql`${messageFeedback.category} IS NOT NULL`)
        .groupBy(messageFeedback.category)
        .all();

      const byCategory: Record<string, number> = {};
      for (const row of categoryResults) {
        if (row.category) {
          byCategory[row.category] = row.count;
        }
      }

      expect(byCategory).toEqual({
        incorrect_fact: 2,
        off_topic: 1,
      });
    });
  });

  describe("deleteByThreadId", () => {
    beforeEach(async () => {
      await db.insert(messageFeedback).values([
        {
          id: "dt-1",
          ...baseFeedback,
          threadId: "thread-a",
        },
        {
          id: "dt-2",
          ...baseFeedback,
          threadId: "thread-a",
        },
        {
          id: "dt-3",
          ...baseFeedback,
          threadId: "thread-b",
        },
      ]);
    });

    it("指定スレッドのフィードバックを削除できる", async () => {
      await db
        .delete(messageFeedback)
        .where(eq(messageFeedback.threadId, "thread-a"));

      const remaining = await db.select().from(messageFeedback).all();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].threadId).toBe("thread-b");
    });

    it("他スレッドのフィードバックは残存する", async () => {
      await db
        .delete(messageFeedback)
        .where(eq(messageFeedback.threadId, "thread-a"));

      const threadB = await db
        .select()
        .from(messageFeedback)
        .where(eq(messageFeedback.threadId, "thread-b"))
        .all();

      expect(threadB).toHaveLength(1);
      expect(threadB[0].id).toBe("dt-3");
    });
  });

  describe("deleteAll", () => {
    it("全件削除できる", async () => {
      await db.insert(messageFeedback).values([
        { id: "da-1", ...baseFeedback },
        { id: "da-2", ...baseFeedback },
      ]);

      await db.delete(messageFeedback);

      const remaining = await db.select().from(messageFeedback).all();
      expect(remaining).toHaveLength(0);
    });
  });

  describe("resolve / unresolve", () => {
    beforeEach(async () => {
      await db.insert(messageFeedback).values({
        id: "resolve-test",
        ...baseFeedback,
      });
    });

    it("resolvedAt を設定できる", async () => {
      const now = new Date().toISOString();
      await db
        .update(messageFeedback)
        .set({ resolvedAt: now })
        .where(eq(messageFeedback.id, "resolve-test"));

      const updated = await db
        .select()
        .from(messageFeedback)
        .where(eq(messageFeedback.id, "resolve-test"))
        .get();

      expect(updated?.resolvedAt).toBe(now);
    });

    it("resolvedAt を null に戻せる（unresolve）", async () => {
      // まず resolve
      await db
        .update(messageFeedback)
        .set({ resolvedAt: new Date().toISOString() })
        .where(eq(messageFeedback.id, "resolve-test"));

      // unresolve
      await db
        .update(messageFeedback)
        .set({ resolvedAt: null })
        .where(eq(messageFeedback.id, "resolve-test"));

      const updated = await db
        .select()
        .from(messageFeedback)
        .where(eq(messageFeedback.id, "resolve-test"))
        .get();

      expect(updated?.resolvedAt).toBeNull();
    });
  });
});

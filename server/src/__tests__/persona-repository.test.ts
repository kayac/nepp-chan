import { and, count, desc, eq, like, lt, or } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { persona } from "~/db";
import { createTestDb, type TestDb } from "./helpers/test-db";

/**
 * persona テーブルに対する Drizzle ORM クエリの統合テスト
 *
 * personaRepository は D1Database を受け取る設計のため、
 * ここでは libsql の in-memory DB を使って Drizzle クエリ自体をテストする
 */
describe("persona Drizzle クエリ", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("insert", () => {
    it("新しいペルソナを作成できる", async () => {
      await db.insert(persona).values({
        id: "test-id",
        resourceId: "village-1",
        category: "好み",
        tags: "男性,高齢者",
        content: "村民は地元産の野菜を好む",
        source: "会話サマリー",
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(persona)
        .where(eq(persona.id, "test-id"))
        .get();

      expect(saved).not.toBeNull();
      expect(saved?.content).toBe("村民は地元産の野菜を好む");
      expect(saved?.category).toBe("好み");
      expect(saved?.tags).toBe("男性,高齢者");
    });

    it("オプション項目なしでも作成できる", async () => {
      await db.insert(persona).values({
        id: "test-id-2",
        resourceId: "village-1",
        category: "価値観",
        content: "助け合いを大切にする",
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(persona)
        .where(eq(persona.id, "test-id-2"))
        .get();

      expect(saved?.tags).toBeNull();
      expect(saved?.source).toBeNull();
      expect(saved?.sentiment).toBe("neutral");
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await db.insert(persona).values({
        id: "update-test",
        resourceId: "village-1",
        category: "好み",
        content: "元の内容",
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("ペルソナの内容を更新できる", async () => {
      await db
        .update(persona)
        .set({
          content: "更新された内容",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(persona.id, "update-test"));

      const updated = await db
        .select()
        .from(persona)
        .where(eq(persona.id, "update-test"))
        .get();

      expect(updated?.content).toBe("更新された内容");
      expect(updated?.updatedAt).not.toBeNull();
    });

    it("複数項目を同時に更新できる", async () => {
      await db
        .update(persona)
        .set({
          category: "新カテゴリ",
          tags: "新タグ",
          content: "新しい内容",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(persona.id, "update-test"));

      const updated = await db
        .select()
        .from(persona)
        .where(eq(persona.id, "update-test"))
        .get();

      expect(updated?.category).toBe("新カテゴリ");
      expect(updated?.tags).toBe("新タグ");
      expect(updated?.content).toBe("新しい内容");
    });
  });

  describe("select by id", () => {
    beforeEach(async () => {
      await db.insert(persona).values({
        id: "find-test",
        resourceId: "village-1",
        category: "好み",
        tags: "男性",
        content: "テスト内容",
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("IDでペルソナを取得できる", async () => {
      const result = await db
        .select()
        .from(persona)
        .where(eq(persona.id, "find-test"))
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("find-test");
      expect(result?.content).toBe("テスト内容");
    });

    it("存在しないIDの場合はundefinedを返す", async () => {
      const result = await db
        .select()
        .from(persona)
        .where(eq(persona.id, "non-existent"))
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("select by resourceId", () => {
    beforeEach(async () => {
      await db.insert(persona).values([
        {
          id: "1",
          resourceId: "village-1",
          category: "好み",
          content: "内容1",
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "2",
          resourceId: "village-1",
          category: "価値観",
          content: "内容2",
          createdAt: "2024-01-02T00:00:00Z",
        },
        {
          id: "3",
          resourceId: "village-2",
          category: "好み",
          content: "別の村",
          createdAt: "2024-01-03T00:00:00Z",
        },
      ]);
    });

    it("リソースIDでペルソナ一覧を取得できる", async () => {
      const result = await db
        .select()
        .from(persona)
        .where(eq(persona.resourceId, "village-1"))
        .orderBy(desc(persona.createdAt))
        .all();

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.resourceId === "village-1")).toBe(true);
    });

    it("降順でソートされる", async () => {
      const result = await db
        .select()
        .from(persona)
        .where(eq(persona.resourceId, "village-1"))
        .orderBy(desc(persona.createdAt))
        .all();

      expect(result[0].id).toBe("2"); // 最新が先頭
      expect(result[1].id).toBe("1");
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await db.insert(persona).values([
        {
          id: "s1",
          resourceId: "village-1",
          category: "好み",
          tags: "男性,高齢者",
          content: "地元産の野菜が人気",
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "s2",
          resourceId: "village-1",
          category: "好み",
          tags: "女性",
          content: "お米を好む",
          createdAt: "2024-01-02T00:00:00Z",
        },
        {
          id: "s3",
          resourceId: "village-1",
          category: "価値観",
          tags: "男性",
          content: "伝統を大切にする",
          createdAt: "2024-01-03T00:00:00Z",
        },
      ]);
    });

    it("カテゴリで検索できる", async () => {
      const result = await db
        .select()
        .from(persona)
        .where(
          and(
            eq(persona.resourceId, "village-1"),
            eq(persona.category, "好み"),
          ),
        )
        .all();

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.category === "好み")).toBe(true);
    });

    it("タグで検索できる", async () => {
      const result = await db
        .select()
        .from(persona)
        .where(
          and(
            eq(persona.resourceId, "village-1"),
            like(persona.tags, "%男性%"),
          ),
        )
        .all();

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.tags?.includes("男性"))).toBe(true);
    });

    it("複数タグのOR検索ができる", async () => {
      const result = await db
        .select()
        .from(persona)
        .where(
          and(
            eq(persona.resourceId, "village-1"),
            or(like(persona.tags, "%女性%"), like(persona.tags, "%高齢者%")),
          ),
        )
        .all();

      expect(result).toHaveLength(2);
    });

    it("キーワードで検索できる", async () => {
      const result = await db
        .select()
        .from(persona)
        .where(
          and(
            eq(persona.resourceId, "village-1"),
            like(persona.content, "%野菜%"),
          ),
        )
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain("野菜");
    });

    it("複合条件で検索できる", async () => {
      const result = await db
        .select()
        .from(persona)
        .where(
          and(
            eq(persona.resourceId, "village-1"),
            eq(persona.category, "好み"),
            like(persona.tags, "%男性%"),
            like(persona.content, "%野菜%"),
          ),
        )
        .limit(10)
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("s1");
    });
  });

  describe("listForAdmin", () => {
    beforeEach(async () => {
      await db.insert(persona).values([
        {
          id: "admin-1",
          resourceId: "village-1",
          category: "好み",
          content: "内容1",
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "admin-2",
          resourceId: "village-1",
          category: "価値観",
          content: "内容2",
          createdAt: "2024-01-02T00:00:00Z",
        },
        {
          id: "admin-3",
          resourceId: "village-2",
          category: "好み",
          content: "内容3",
          createdAt: "2024-01-03T00:00:00Z",
        },
        {
          id: "admin-4",
          resourceId: "village-1",
          category: "意見",
          content: "内容4",
          createdAt: "2024-01-03T00:00:00Z", // admin-3 と同じ createdAt
        },
      ]);
    });

    it("total 付きで全件取得できる", async () => {
      const results = await db
        .select()
        .from(persona)
        .orderBy(desc(persona.createdAt), desc(persona.id))
        .all();

      const countResult = await db
        .select({ count: count() })
        .from(persona)
        .get();

      expect(results).toHaveLength(4);
      expect(countResult?.count).toBe(4);
    });

    it("limit で取得件数を制限できる", async () => {
      const limit = 2;
      const results = await db
        .select()
        .from(persona)
        .orderBy(desc(persona.createdAt), desc(persona.id))
        .limit(limit + 1)
        .all();

      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;

      expect(items).toHaveLength(2);
      expect(hasMore).toBe(true);
    });

    it("複合カーソル（createdAt_id）で次ページを取得できる", async () => {
      const limit = 2;

      // 1ページ目
      const page1 = await db
        .select()
        .from(persona)
        .orderBy(desc(persona.createdAt), desc(persona.id))
        .limit(limit + 1)
        .all();

      const items1 = page1.slice(0, limit);
      const lastItem = items1[items1.length - 1];
      const cursor = `${lastItem.createdAt}_${lastItem.id}`;

      // 2ページ目: 複合カーソル条件
      const [cursorCreatedAt, cursorId] = cursor.split("_");
      const page2 = await db
        .select()
        .from(persona)
        .where(
          or(
            lt(persona.createdAt, cursorCreatedAt),
            and(
              eq(persona.createdAt, cursorCreatedAt),
              lt(persona.id, cursorId),
            ),
          ),
        )
        .orderBy(desc(persona.createdAt), desc(persona.id))
        .limit(limit + 1)
        .all();

      // 2ページ目のアイテムは1ページ目と重複しない
      const page1Ids = items1.map((p) => p.id);
      for (const item of page2) {
        expect(page1Ids).not.toContain(item.id);
      }
    });

    it("空結果の場合", async () => {
      // 全データ削除
      await db.delete(persona);

      const results = await db
        .select()
        .from(persona)
        .orderBy(desc(persona.createdAt), desc(persona.id))
        .all();

      const countResult = await db
        .select({ count: count() })
        .from(persona)
        .get();

      expect(results).toHaveLength(0);
      expect(countResult?.count).toBe(0);
    });

    it("hasMore が正しく判定される", async () => {
      // limit=4 → 4件ちょうどなので hasMore=false
      const limit = 4;
      const results = await db
        .select()
        .from(persona)
        .orderBy(desc(persona.createdAt), desc(persona.id))
        .limit(limit + 1)
        .all();

      const hasMore = results.length > limit;
      expect(hasMore).toBe(false);

      // limit=3 → 4件あるので hasMore=true
      const limit2 = 3;
      const results2 = await db
        .select()
        .from(persona)
        .orderBy(desc(persona.createdAt), desc(persona.id))
        .limit(limit2 + 1)
        .all();

      const hasMore2 = results2.length > limit2;
      expect(hasMore2).toBe(true);
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await db.insert(persona).values({
        id: "delete-test",
        resourceId: "village-1",
        category: "好み",
        content: "削除対象",
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("ペルソナを削除できる", async () => {
      await db.delete(persona).where(eq(persona.id, "delete-test"));

      const deleted = await db
        .select()
        .from(persona)
        .where(eq(persona.id, "delete-test"))
        .get();

      expect(deleted).toBeUndefined();
    });
  });
});

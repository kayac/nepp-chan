import { desc, eq, gte } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { emergencyReports } from "~/db";
import { createTestDb, type TestDb } from "./helpers/test-db";

/**
 * emergency_reports テーブルに対する Drizzle ORM クエリの統合テスト
 *
 * emergencyRepository は D1Database を受け取る設計のため、
 * ここでは libsql の in-memory DB を使って Drizzle クエリ自体をテストする
 */
describe("emergency_reports Drizzle クエリ", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("insert", () => {
    it("新しい緊急報告を作成できる", async () => {
      await db.insert(emergencyReports).values({
        id: "test-id",
        type: "disaster",
        description: "大雪による道路封鎖",
        location: "音威子府村中心部",
        reportedAt: "2024-01-15T10:00:00Z",
      });

      const saved = await db
        .select()
        .from(emergencyReports)
        .where(eq(emergencyReports.id, "test-id"))
        .get();

      expect(saved).not.toBeNull();
      expect(saved?.type).toBe("disaster");
      expect(saved?.description).toBe("大雪による道路封鎖");
      expect(saved?.location).toBe("音威子府村中心部");
      expect(saved?.reportedAt).toBe("2024-01-15T10:00:00Z");
    });

    it("オプション項目なしでも作成できる", async () => {
      await db.insert(emergencyReports).values({
        id: "test-id-2",
        type: "accident",
        reportedAt: "2024-01-15T10:00:00Z",
      });

      const saved = await db
        .select()
        .from(emergencyReports)
        .where(eq(emergencyReports.id, "test-id-2"))
        .get();

      expect(saved?.description).toBeNull();
      expect(saved?.location).toBeNull();
      expect(saved?.updatedAt).toBeNull();
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await db.insert(emergencyReports).values({
        id: "update-test",
        type: "disaster",
        description: "元の説明",
        location: "元の場所",
        reportedAt: "2024-01-15T10:00:00Z",
      });
    });

    it("説明を更新できる", async () => {
      await db
        .update(emergencyReports)
        .set({
          description: "更新された説明",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(emergencyReports.id, "update-test"));

      const updated = await db
        .select()
        .from(emergencyReports)
        .where(eq(emergencyReports.id, "update-test"))
        .get();

      expect(updated?.description).toBe("更新された説明");
      expect(updated?.updatedAt).not.toBeNull();
    });

    it("場所を更新できる", async () => {
      await db
        .update(emergencyReports)
        .set({
          location: "新しい場所",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(emergencyReports.id, "update-test"));

      const updated = await db
        .select()
        .from(emergencyReports)
        .where(eq(emergencyReports.id, "update-test"))
        .get();

      expect(updated?.location).toBe("新しい場所");
    });
  });

  describe("findById", () => {
    beforeEach(async () => {
      await db.insert(emergencyReports).values({
        id: "find-test",
        type: "disaster",
        description: "テスト報告",
        reportedAt: "2024-01-15T10:00:00Z",
      });
    });

    it("IDで緊急報告を取得できる", async () => {
      const result = await db
        .select()
        .from(emergencyReports)
        .where(eq(emergencyReports.id, "find-test"))
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("find-test");
      expect(result?.description).toBe("テスト報告");
    });

    it("存在しないIDの場合はundefinedを返す", async () => {
      const result = await db
        .select()
        .from(emergencyReports)
        .where(eq(emergencyReports.id, "non-existent"))
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("findAll", () => {
    beforeEach(async () => {
      await db.insert(emergencyReports).values([
        {
          id: "1",
          type: "disaster",
          description: "大雪",
          reportedAt: "2024-01-01T10:00:00Z",
        },
        {
          id: "2",
          type: "accident",
          description: "事故",
          reportedAt: "2024-01-02T10:00:00Z",
        },
        {
          id: "3",
          type: "disaster",
          description: "停電",
          reportedAt: "2024-01-03T10:00:00Z",
        },
      ]);
    });

    it("全件を報告日時の降順で取得できる", async () => {
      const results = await db
        .select()
        .from(emergencyReports)
        .orderBy(desc(emergencyReports.reportedAt))
        .all();

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe("3");
      expect(results[1].id).toBe("2");
      expect(results[2].id).toBe("1");
    });

    it("limitで取得件数を制限できる", async () => {
      const results = await db
        .select()
        .from(emergencyReports)
        .orderBy(desc(emergencyReports.reportedAt))
        .limit(2)
        .all();

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("3");
    });
  });

  describe("findRecent", () => {
    beforeEach(async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      await db.insert(emergencyReports).values([
        {
          id: "recent-1",
          type: "disaster",
          description: "最近の報告",
          reportedAt: now.toISOString(),
        },
        {
          id: "recent-2",
          type: "accident",
          description: "2日前の報告",
          reportedAt: twoDaysAgo.toISOString(),
        },
        {
          id: "old-1",
          type: "disaster",
          description: "10日前の報告",
          reportedAt: tenDaysAgo.toISOString(),
        },
      ]);
    });

    it("指定日数以内の報告のみ取得できる", async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceIso = since.toISOString();

      const results = await db
        .select()
        .from(emergencyReports)
        .where(gte(emergencyReports.reportedAt, sinceIso))
        .orderBy(desc(emergencyReports.reportedAt))
        .all();

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.reportedAt >= sinceIso)).toBe(true);
    });

    it("1日以内の報告を取得できる", async () => {
      const since = new Date();
      since.setDate(since.getDate() - 1);
      const sinceIso = since.toISOString();

      const results = await db
        .select()
        .from(emergencyReports)
        .where(gte(emergencyReports.reportedAt, sinceIso))
        .orderBy(desc(emergencyReports.reportedAt))
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("recent-1");
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await db.insert(emergencyReports).values({
        id: "delete-test",
        type: "disaster",
        description: "削除対象",
        reportedAt: "2024-01-15T10:00:00Z",
      });
    });

    it("緊急報告を削除できる", async () => {
      await db
        .delete(emergencyReports)
        .where(eq(emergencyReports.id, "delete-test"));

      const deleted = await db
        .select()
        .from(emergencyReports)
        .where(eq(emergencyReports.id, "delete-test"))
        .get();

      expect(deleted).toBeUndefined();
    });
  });
});

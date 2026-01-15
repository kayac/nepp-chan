import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { adminSessions, adminUsers } from "~/db";
import { createTestDb, type TestDb } from "./helpers/test-db";

/**
 * admin_sessions テーブルに対する Drizzle ORM クエリの統合テスト
 */
describe("adminSessions Drizzle クエリ", () => {
  let db: TestDb;

  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const testUser = {
    id: "user-1",
    email: "admin@example.com",
    name: "管理者",
    role: "admin",
    createdAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(async () => {
    db = await createTestDb();
    // テスト用ユーザーを作成
    await db.insert(adminUsers).values(testUser);
  });

  describe("insert", () => {
    it("新しいセッションを作成できる", async () => {
      await db.insert(adminSessions).values({
        id: "session-1",
        userId: testUser.id,
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.id, "session-1"))
        .get();

      expect(saved).not.toBeNull();
      expect(saved?.userId).toBe(testUser.id);
      expect(saved?.expiresAt).toBe(futureDate);
      expect(saved?.lastAccessedAt).toBeNull();
    });

    it("lastAccessedAt 付きでセッションを作成できる", async () => {
      const lastAccessed = "2024-01-01T12:00:00Z";
      await db.insert(adminSessions).values({
        id: "session-with-access",
        userId: testUser.id,
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
        lastAccessedAt: lastAccessed,
      });

      const saved = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.id, "session-with-access"))
        .get();

      expect(saved?.lastAccessedAt).toBe(lastAccessed);
    });
  });

  describe("select by id", () => {
    beforeEach(async () => {
      await db.insert(adminSessions).values({
        id: "find-session",
        userId: testUser.id,
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("IDでセッションを取得できる", async () => {
      const result = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.id, "find-session"))
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("find-session");
      expect(result?.userId).toBe(testUser.id);
    });

    it("存在しないIDの場合はundefinedを返す", async () => {
      const result = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.id, "non-existent"))
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("findValidSession", () => {
    it("有効なセッションを取得できる", async () => {
      await db.insert(adminSessions).values({
        id: "valid-session",
        userId: testUser.id,
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const now = new Date().toISOString();
      const result = await db
        .select()
        .from(adminSessions)
        .where(
          and(
            eq(adminSessions.id, "valid-session"),
            sql`${adminSessions.expiresAt} > ${now}`,
          ),
        )
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("valid-session");
    });

    it("期限切れのセッションは取得できない", async () => {
      await db.insert(adminSessions).values({
        id: "expired-session",
        userId: testUser.id,
        expiresAt: pastDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const now = new Date().toISOString();
      const result = await db
        .select()
        .from(adminSessions)
        .where(
          and(
            eq(adminSessions.id, "expired-session"),
            sql`${adminSessions.expiresAt} > ${now}`,
          ),
        )
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("findWithUser (join)", () => {
    beforeEach(async () => {
      await db.insert(adminSessions).values({
        id: "session-for-join",
        userId: testUser.id,
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("セッションとユーザー情報を結合して取得できる", async () => {
      const now = new Date().toISOString();
      const result = await db
        .select({
          session: adminSessions,
          user: adminUsers,
        })
        .from(adminSessions)
        .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
        .where(
          and(
            eq(adminSessions.id, "session-for-join"),
            sql`${adminSessions.expiresAt} > ${now}`,
          ),
        )
        .get();

      expect(result).not.toBeNull();
      expect(result?.session.id).toBe("session-for-join");
      expect(result?.user.id).toBe(testUser.id);
      expect(result?.user.email).toBe(testUser.email);
    });
  });

  describe("update lastAccessedAt", () => {
    beforeEach(async () => {
      await db.insert(adminSessions).values({
        id: "update-session",
        userId: testUser.id,
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("最終アクセス日時を更新できる", async () => {
      const accessedAt = new Date().toISOString();
      await db
        .update(adminSessions)
        .set({ lastAccessedAt: accessedAt })
        .where(eq(adminSessions.id, "update-session"));

      const updated = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.id, "update-session"))
        .get();

      expect(updated?.lastAccessedAt).toBe(accessedAt);
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await db.insert(adminSessions).values({
        id: "delete-session",
        userId: testUser.id,
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("セッションを削除できる", async () => {
      await db
        .delete(adminSessions)
        .where(eq(adminSessions.id, "delete-session"));

      const deleted = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.id, "delete-session"))
        .get();

      expect(deleted).toBeUndefined();
    });
  });

  describe("deleteByUserId", () => {
    beforeEach(async () => {
      await db.insert(adminSessions).values([
        {
          id: "session-a",
          userId: testUser.id,
          expiresAt: futureDate,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "session-b",
          userId: testUser.id,
          expiresAt: futureDate,
          createdAt: "2024-01-02T00:00:00Z",
        },
      ]);
    });

    it("ユーザーIDで全セッションを削除できる", async () => {
      await db
        .delete(adminSessions)
        .where(eq(adminSessions.userId, testUser.id));

      const remaining = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.userId, testUser.id))
        .all();

      expect(remaining).toHaveLength(0);
    });
  });

  describe("deleteExpired", () => {
    beforeEach(async () => {
      await db.insert(adminSessions).values([
        {
          id: "valid-for-cleanup",
          userId: testUser.id,
          expiresAt: futureDate,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "expired-for-cleanup",
          userId: testUser.id,
          expiresAt: pastDate,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ]);
    });

    it("期限切れのセッションのみ削除できる", async () => {
      const now = new Date().toISOString();
      await db
        .delete(adminSessions)
        .where(sql`${adminSessions.expiresAt} < ${now}`);

      const remaining = await db.select().from(adminSessions).all();

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("valid-for-cleanup");
    });
  });

  describe("cascade delete", () => {
    beforeEach(async () => {
      await db.insert(adminSessions).values({
        id: "cascade-session",
        userId: testUser.id,
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("ユーザー削除時にセッションも削除される", async () => {
      // ユーザーを削除
      await db.delete(adminUsers).where(eq(adminUsers.id, testUser.id));

      // セッションも削除されていることを確認
      const session = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.id, "cascade-session"))
        .get();

      expect(session).toBeUndefined();
    });
  });
});

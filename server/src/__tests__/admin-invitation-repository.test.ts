import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { adminInvitations } from "~/db";
import { createTestDb, type TestDb } from "./helpers/test-db";

/**
 * admin_invitations テーブルに対する Drizzle ORM クエリの統合テスト
 */
describe("adminInvitations Drizzle クエリ", () => {
  let db: TestDb;

  const futureDate = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("insert", () => {
    it("新しい招待を作成できる", async () => {
      await db.insert(adminInvitations).values({
        id: "inv-1",
        email: "invite@example.com",
        token: "token-abc123",
        invitedBy: "system",
        role: "admin",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminInvitations)
        .where(eq(adminInvitations.id, "inv-1"))
        .get();

      expect(saved).not.toBeNull();
      expect(saved?.email).toBe("invite@example.com");
      expect(saved?.token).toBe("token-abc123");
      expect(saved?.invitedBy).toBe("system");
      expect(saved?.role).toBe("admin");
      expect(saved?.usedAt).toBeNull();
    });

    it("super_admin ロールで招待を作成できる", async () => {
      await db.insert(adminInvitations).values({
        id: "inv-super",
        email: "super@example.com",
        token: "token-super",
        invitedBy: "admin-1",
        role: "super_admin",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminInvitations)
        .where(eq(adminInvitations.id, "inv-super"))
        .get();

      expect(saved?.role).toBe("super_admin");
    });

    it("同じメールアドレスで重複作成するとエラーになる", async () => {
      await db.insert(adminInvitations).values({
        id: "inv-dup-1",
        email: "duplicate@example.com",
        token: "token-1",
        invitedBy: "system",
        role: "admin",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      await expect(
        db.insert(adminInvitations).values({
          id: "inv-dup-2",
          email: "duplicate@example.com",
          token: "token-2",
          invitedBy: "system",
          role: "admin",
          expiresAt: futureDate,
          createdAt: "2024-01-02T00:00:00Z",
        }),
      ).rejects.toThrow();
    });

    it("同じトークンで重複作成するとエラーになる", async () => {
      await db.insert(adminInvitations).values({
        id: "inv-tok-1",
        email: "token1@example.com",
        token: "same-token",
        invitedBy: "system",
        role: "admin",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      await expect(
        db.insert(adminInvitations).values({
          id: "inv-tok-2",
          email: "token2@example.com",
          token: "same-token",
          invitedBy: "system",
          role: "admin",
          expiresAt: futureDate,
          createdAt: "2024-01-02T00:00:00Z",
        }),
      ).rejects.toThrow();
    });
  });

  describe("select by token", () => {
    beforeEach(async () => {
      await db.insert(adminInvitations).values({
        id: "find-by-token",
        email: "token-search@example.com",
        token: "unique-token",
        invitedBy: "system",
        role: "admin",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("トークンで招待を取得できる", async () => {
      const result = await db
        .select()
        .from(adminInvitations)
        .where(eq(adminInvitations.token, "unique-token"))
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("find-by-token");
    });

    it("存在しないトークンの場合はundefinedを返す", async () => {
      const result = await db
        .select()
        .from(adminInvitations)
        .where(eq(adminInvitations.token, "nonexistent-token"))
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("select by email", () => {
    beforeEach(async () => {
      await db.insert(adminInvitations).values({
        id: "find-by-email",
        email: "email-search@example.com",
        token: "email-token",
        invitedBy: "system",
        role: "admin",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("メールアドレスで招待を取得できる", async () => {
      const result = await db
        .select()
        .from(adminInvitations)
        .where(eq(adminInvitations.email, "email-search@example.com"))
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("find-by-email");
    });
  });

  describe("findValidByToken", () => {
    it("未使用かつ期限内の招待を取得できる", async () => {
      await db.insert(adminInvitations).values({
        id: "valid-inv",
        email: "valid@example.com",
        token: "valid-token",
        invitedBy: "system",
        role: "admin",
        expiresAt: futureDate,
        usedAt: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const now = new Date().toISOString();
      const result = await db
        .select()
        .from(adminInvitations)
        .where(
          and(
            eq(adminInvitations.token, "valid-token"),
            isNull(adminInvitations.usedAt),
            sql`${adminInvitations.expiresAt} > ${now}`,
          ),
        )
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("valid-inv");
    });

    it("使用済みの招待は取得できない", async () => {
      await db.insert(adminInvitations).values({
        id: "used-inv",
        email: "used@example.com",
        token: "used-token",
        invitedBy: "system",
        role: "admin",
        expiresAt: futureDate,
        usedAt: "2024-01-01T12:00:00Z",
        createdAt: "2024-01-01T00:00:00Z",
      });

      const now = new Date().toISOString();
      const result = await db
        .select()
        .from(adminInvitations)
        .where(
          and(
            eq(adminInvitations.token, "used-token"),
            isNull(adminInvitations.usedAt),
            sql`${adminInvitations.expiresAt} > ${now}`,
          ),
        )
        .get();

      expect(result).toBeUndefined();
    });

    it("期限切れの招待は取得できない", async () => {
      await db.insert(adminInvitations).values({
        id: "expired-inv",
        email: "expired@example.com",
        token: "expired-token",
        invitedBy: "system",
        role: "admin",
        expiresAt: pastDate,
        usedAt: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const now = new Date().toISOString();
      const result = await db
        .select()
        .from(adminInvitations)
        .where(
          and(
            eq(adminInvitations.token, "expired-token"),
            isNull(adminInvitations.usedAt),
            sql`${adminInvitations.expiresAt} > ${now}`,
          ),
        )
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("listPending", () => {
    beforeEach(async () => {
      await db.insert(adminInvitations).values([
        // 有効な招待
        {
          id: "pending-1",
          email: "pending1@example.com",
          token: "pending-token-1",
          invitedBy: "system",
          role: "admin",
          expiresAt: futureDate,
          usedAt: null,
          createdAt: "2024-01-01T00:00:00Z",
        },
        // 有効な招待
        {
          id: "pending-2",
          email: "pending2@example.com",
          token: "pending-token-2",
          invitedBy: "system",
          role: "admin",
          expiresAt: futureDate,
          usedAt: null,
          createdAt: "2024-01-02T00:00:00Z",
        },
        // 使用済み
        {
          id: "used-1",
          email: "used1@example.com",
          token: "used-token-1",
          invitedBy: "system",
          role: "admin",
          expiresAt: futureDate,
          usedAt: "2024-01-01T12:00:00Z",
          createdAt: "2024-01-01T00:00:00Z",
        },
        // 期限切れ
        {
          id: "expired-1",
          email: "expired1@example.com",
          token: "expired-token-1",
          invitedBy: "system",
          role: "admin",
          expiresAt: pastDate,
          usedAt: null,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ]);
    });

    it("未使用かつ期限内の招待一覧を取得できる", async () => {
      const now = new Date().toISOString();
      const result = await db
        .select()
        .from(adminInvitations)
        .where(
          and(
            isNull(adminInvitations.usedAt),
            sql`${adminInvitations.expiresAt} > ${now}`,
          ),
        )
        .orderBy(desc(adminInvitations.createdAt))
        .all();

      expect(result).toHaveLength(2);
      expect(result.every((inv) => inv.usedAt === null)).toBe(true);
      // 降順であることを確認
      expect(result[0].id).toBe("pending-2");
      expect(result[1].id).toBe("pending-1");
    });
  });

  describe("markUsed", () => {
    beforeEach(async () => {
      await db.insert(adminInvitations).values({
        id: "mark-used",
        email: "markused@example.com",
        token: "markused-token",
        invitedBy: "system",
        role: "admin",
        expiresAt: futureDate,
        usedAt: null,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("招待を使用済みにできる", async () => {
      const usedAt = new Date().toISOString();
      await db
        .update(adminInvitations)
        .set({ usedAt })
        .where(eq(adminInvitations.id, "mark-used"));

      const updated = await db
        .select()
        .from(adminInvitations)
        .where(eq(adminInvitations.id, "mark-used"))
        .get();

      expect(updated?.usedAt).toBe(usedAt);
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await db.insert(adminInvitations).values({
        id: "delete-inv",
        email: "delete@example.com",
        token: "delete-token",
        invitedBy: "system",
        role: "admin",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("招待を削除できる", async () => {
      await db
        .delete(adminInvitations)
        .where(eq(adminInvitations.id, "delete-inv"));

      const deleted = await db
        .select()
        .from(adminInvitations)
        .where(eq(adminInvitations.id, "delete-inv"))
        .get();

      expect(deleted).toBeUndefined();
    });
  });

  describe("deleteExpired", () => {
    beforeEach(async () => {
      await db.insert(adminInvitations).values([
        {
          id: "valid-for-delete",
          email: "valid@example.com",
          token: "valid-delete-token",
          invitedBy: "system",
          role: "admin",
          expiresAt: futureDate,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "expired-for-delete",
          email: "expired@example.com",
          token: "expired-delete-token",
          invitedBy: "system",
          role: "admin",
          expiresAt: pastDate,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ]);
    });

    it("期限切れの招待のみ削除できる", async () => {
      const now = new Date().toISOString();
      await db
        .delete(adminInvitations)
        .where(sql`${adminInvitations.expiresAt} < ${now}`);

      const remaining = await db.select().from(adminInvitations).all();

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("valid-for-delete");
    });
  });
});

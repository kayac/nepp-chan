import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { adminUsers } from "~/db";
import { createTestDb, type TestDb } from "./helpers/test-db";

/**
 * admin_users テーブルに対する Drizzle ORM クエリの統合テスト
 */
describe("adminUsers Drizzle クエリ", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("insert", () => {
    it("新しい管理者ユーザーを作成できる", async () => {
      await db.insert(adminUsers).values({
        id: "user-1",
        email: "admin@example.com",
        name: "管理者",
        role: "admin",
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, "user-1"))
        .get();

      expect(saved).not.toBeNull();
      expect(saved?.email).toBe("admin@example.com");
      expect(saved?.name).toBe("管理者");
      expect(saved?.role).toBe("admin");
    });

    it("名前なしでも作成できる", async () => {
      await db.insert(adminUsers).values({
        id: "user-2",
        email: "admin2@example.com",
        role: "admin",
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, "user-2"))
        .get();

      expect(saved?.name).toBeNull();
      expect(saved?.email).toBe("admin2@example.com");
    });

    it("super_admin ロールで作成できる", async () => {
      await db.insert(adminUsers).values({
        id: "user-3",
        email: "super@example.com",
        role: "super_admin",
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, "user-3"))
        .get();

      expect(saved?.role).toBe("super_admin");
    });

    it("同じメールアドレスで重複作成するとエラーになる", async () => {
      await db.insert(adminUsers).values({
        id: "user-dup-1",
        email: "duplicate@example.com",
        role: "admin",
        createdAt: "2024-01-01T00:00:00Z",
      });

      await expect(
        db.insert(adminUsers).values({
          id: "user-dup-2",
          email: "duplicate@example.com",
          role: "admin",
          createdAt: "2024-01-02T00:00:00Z",
        }),
      ).rejects.toThrow();
    });
  });

  describe("select by id", () => {
    beforeEach(async () => {
      await db.insert(adminUsers).values({
        id: "find-test",
        email: "find@example.com",
        name: "検索テスト",
        role: "admin",
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("IDでユーザーを取得できる", async () => {
      const result = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, "find-test"))
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("find-test");
      expect(result?.email).toBe("find@example.com");
    });

    it("存在しないIDの場合はundefinedを返す", async () => {
      const result = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, "non-existent"))
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("select by email", () => {
    beforeEach(async () => {
      await db.insert(adminUsers).values({
        id: "email-test",
        email: "email-test@example.com",
        name: "メールテスト",
        role: "admin",
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("メールアドレスでユーザーを取得できる", async () => {
      const result = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, "email-test@example.com"))
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("email-test");
    });

    it("存在しないメールアドレスの場合はundefinedを返す", async () => {
      const result = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, "nonexistent@example.com"))
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await db.insert(adminUsers).values({
        id: "update-test",
        email: "update@example.com",
        name: "元の名前",
        role: "admin",
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("名前を更新できる", async () => {
      await db
        .update(adminUsers)
        .set({
          name: "新しい名前",
          updatedAt: "2024-01-02T00:00:00Z",
        })
        .where(eq(adminUsers.id, "update-test"));

      const updated = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, "update-test"))
        .get();

      expect(updated?.name).toBe("新しい名前");
      expect(updated?.updatedAt).toBe("2024-01-02T00:00:00Z");
    });

    it("ロールを更新できる", async () => {
      await db
        .update(adminUsers)
        .set({
          role: "super_admin",
          updatedAt: "2024-01-02T00:00:00Z",
        })
        .where(eq(adminUsers.id, "update-test"));

      const updated = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, "update-test"))
        .get();

      expect(updated?.role).toBe("super_admin");
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await db.insert(adminUsers).values({
        id: "delete-test",
        email: "delete@example.com",
        role: "admin",
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("ユーザーを削除できる", async () => {
      await db.delete(adminUsers).where(eq(adminUsers.id, "delete-test"));

      const deleted = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, "delete-test"))
        .get();

      expect(deleted).toBeUndefined();
    });
  });

  describe("list", () => {
    beforeEach(async () => {
      await db.insert(adminUsers).values([
        {
          id: "list-1",
          email: "list1@example.com",
          role: "admin",
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "list-2",
          email: "list2@example.com",
          role: "super_admin",
          createdAt: "2024-01-02T00:00:00Z",
        },
        {
          id: "list-3",
          email: "list3@example.com",
          role: "admin",
          createdAt: "2024-01-03T00:00:00Z",
        },
      ]);
    });

    it("全てのユーザーを取得できる", async () => {
      const result = await db.select().from(adminUsers).all();

      expect(result).toHaveLength(3);
    });

    it("ロールでフィルターできる", async () => {
      const result = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.role, "admin"))
        .all();

      expect(result).toHaveLength(2);
      expect(result.every((u) => u.role === "admin")).toBe(true);
    });
  });
});

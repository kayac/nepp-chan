import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { adminUsers } from "~/db";
import { createTestDb, type TestDb } from "../test-helpers/test-db";

describe("adminUsers Drizzle クエリ", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("insert", () => {
    it("新しい管理者ユーザーを作成できる", async () => {
      await db.insert(adminUsers).values({
        id: "user-1",
        username: "admin01",
        name: "管理者",
        role: "admin",
        passwordHash: "100000:salt:hash",
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, "user-1"))
        .get();

      expect(saved).not.toBeNull();
      expect(saved?.username).toBe("admin01");
      expect(saved?.name).toBe("管理者");
      expect(saved?.role).toBe("admin");
    });

    it("名前なしでも作成できる", async () => {
      await db.insert(adminUsers).values({
        id: "user-2",
        username: "admin02",
        role: "admin",
        passwordHash: "100000:salt:hash",
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, "user-2"))
        .get();

      expect(saved?.name).toBeNull();
      expect(saved?.username).toBe("admin02");
    });

    it("super_admin ロールで作成できる", async () => {
      await db.insert(adminUsers).values({
        id: "user-3",
        username: "superadmin",
        role: "super_admin",
        passwordHash: "100000:salt:hash",
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, "user-3"))
        .get();

      expect(saved?.role).toBe("super_admin");
    });

    it("同じユーザー名で重複作成するとエラーになる", async () => {
      await db.insert(adminUsers).values({
        id: "user-dup-1",
        username: "duplicate",
        role: "admin",
        passwordHash: "100000:salt:hash",
        createdAt: "2024-01-01T00:00:00Z",
      });

      await expect(
        db.insert(adminUsers).values({
          id: "user-dup-2",
          username: "duplicate",
          role: "admin",
          passwordHash: "100000:salt:hash",
          createdAt: "2024-01-02T00:00:00Z",
        }),
      ).rejects.toThrow();
    });
  });

  describe("select by id", () => {
    beforeEach(async () => {
      await db.insert(adminUsers).values({
        id: "find-test",
        username: "finduser",
        name: "検索テスト",
        role: "admin",
        passwordHash: "100000:salt:hash",
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
      expect(result?.username).toBe("finduser");
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

  describe("select by username", () => {
    beforeEach(async () => {
      await db.insert(adminUsers).values({
        id: "username-test",
        username: "usernametest",
        name: "ユーザー名テスト",
        role: "admin",
        passwordHash: "100000:salt:hash",
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("ユーザー名でユーザーを取得できる", async () => {
      const result = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.username, "usernametest"))
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("username-test");
    });

    it("存在しないユーザー名の場合はundefinedを返す", async () => {
      const result = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.username, "nonexistent"))
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await db.insert(adminUsers).values({
        id: "update-test",
        username: "updateuser",
        name: "元の名前",
        role: "admin",
        passwordHash: "100000:salt:hash",
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
        username: "deleteuser",
        role: "admin",
        passwordHash: "100000:salt:hash",
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
          username: "listuser1",
          role: "admin",
          passwordHash: "100000:salt:hash",
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "list-2",
          username: "listuser2",
          role: "super_admin",
          passwordHash: "100000:salt:hash",
          createdAt: "2024-01-02T00:00:00Z",
        },
        {
          id: "list-3",
          username: "listuser3",
          role: "admin",
          passwordHash: "100000:salt:hash",
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

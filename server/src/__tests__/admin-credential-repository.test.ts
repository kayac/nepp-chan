import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { adminCredentials, adminUsers } from "~/db";
import { createTestDb, type TestDb } from "./helpers/test-db";

/**
 * admin_credentials テーブルに対する Drizzle ORM クエリの統合テスト
 */
describe("adminCredentials Drizzle クエリ", () => {
  let db: TestDb;

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
    it("新しいクレデンシャルを作成できる", async () => {
      await db.insert(adminCredentials).values({
        id: "cred-base64-id",
        userId: testUser.id,
        publicKey: "public-key-base64",
        counter: 0,
        deviceType: "singleDevice",
        backedUp: false,
        transports: JSON.stringify(["internal"]),
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminCredentials)
        .where(eq(adminCredentials.id, "cred-base64-id"))
        .get();

      expect(saved).not.toBeNull();
      expect(saved?.userId).toBe(testUser.id);
      expect(saved?.publicKey).toBe("public-key-base64");
      expect(saved?.counter).toBe(0);
      expect(saved?.deviceType).toBe("singleDevice");
      expect(saved?.backedUp).toBe(false);
    });

    it("multiDevice タイプで作成できる", async () => {
      await db.insert(adminCredentials).values({
        id: "cred-multi",
        userId: testUser.id,
        publicKey: "public-key-multi",
        counter: 0,
        deviceType: "multiDevice",
        backedUp: true,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminCredentials)
        .where(eq(adminCredentials.id, "cred-multi"))
        .get();

      expect(saved?.deviceType).toBe("multiDevice");
      expect(saved?.backedUp).toBe(true);
    });

    it("transports なしでも作成できる", async () => {
      await db.insert(adminCredentials).values({
        id: "cred-no-transport",
        userId: testUser.id,
        publicKey: "public-key",
        counter: 0,
        deviceType: "singleDevice",
        backedUp: false,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(adminCredentials)
        .where(eq(adminCredentials.id, "cred-no-transport"))
        .get();

      expect(saved?.transports).toBeNull();
    });
  });

  describe("select by id", () => {
    beforeEach(async () => {
      await db.insert(adminCredentials).values({
        id: "find-cred",
        userId: testUser.id,
        publicKey: "test-key",
        counter: 5,
        deviceType: "singleDevice",
        backedUp: false,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("IDでクレデンシャルを取得できる", async () => {
      const result = await db
        .select()
        .from(adminCredentials)
        .where(eq(adminCredentials.id, "find-cred"))
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("find-cred");
      expect(result?.counter).toBe(5);
    });

    it("存在しないIDの場合はundefinedを返す", async () => {
      const result = await db
        .select()
        .from(adminCredentials)
        .where(eq(adminCredentials.id, "non-existent"))
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("select by userId", () => {
    beforeEach(async () => {
      // 同じユーザーに複数のクレデンシャルを追加
      await db.insert(adminCredentials).values([
        {
          id: "cred-1",
          userId: testUser.id,
          publicKey: "key-1",
          counter: 0,
          deviceType: "singleDevice",
          backedUp: false,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "cred-2",
          userId: testUser.id,
          publicKey: "key-2",
          counter: 0,
          deviceType: "multiDevice",
          backedUp: true,
          createdAt: "2024-01-02T00:00:00Z",
        },
      ]);
    });

    it("ユーザーIDで全てのクレデンシャルを取得できる", async () => {
      const result = await db
        .select()
        .from(adminCredentials)
        .where(eq(adminCredentials.userId, testUser.id))
        .all();

      expect(result).toHaveLength(2);
      expect(result.every((c) => c.userId === testUser.id)).toBe(true);
    });
  });

  describe("update counter", () => {
    beforeEach(async () => {
      await db.insert(adminCredentials).values({
        id: "counter-test",
        userId: testUser.id,
        publicKey: "test-key",
        counter: 5,
        deviceType: "singleDevice",
        backedUp: false,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("カウンターを更新できる", async () => {
      await db
        .update(adminCredentials)
        .set({ counter: 6, lastUsedAt: "2024-01-02T00:00:00Z" })
        .where(eq(adminCredentials.id, "counter-test"));

      const updated = await db
        .select()
        .from(adminCredentials)
        .where(eq(adminCredentials.id, "counter-test"))
        .get();

      expect(updated?.counter).toBe(6);
      expect(updated?.lastUsedAt).toBe("2024-01-02T00:00:00Z");
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await db.insert(adminCredentials).values({
        id: "delete-cred",
        userId: testUser.id,
        publicKey: "delete-key",
        counter: 0,
        deviceType: "singleDevice",
        backedUp: false,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("クレデンシャルを削除できる", async () => {
      await db
        .delete(adminCredentials)
        .where(eq(adminCredentials.id, "delete-cred"));

      const deleted = await db
        .select()
        .from(adminCredentials)
        .where(eq(adminCredentials.id, "delete-cred"))
        .get();

      expect(deleted).toBeUndefined();
    });
  });

  describe("cascade delete", () => {
    beforeEach(async () => {
      await db.insert(adminCredentials).values({
        id: "cascade-cred",
        userId: testUser.id,
        publicKey: "cascade-key",
        counter: 0,
        deviceType: "singleDevice",
        backedUp: false,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("ユーザー削除時にクレデンシャルも削除される", async () => {
      // ユーザーを削除
      await db.delete(adminUsers).where(eq(adminUsers.id, testUser.id));

      // クレデンシャルも削除されていることを確認
      const credential = await db
        .select()
        .from(adminCredentials)
        .where(eq(adminCredentials.id, "cascade-cred"))
        .get();

      expect(credential).toBeUndefined();
    });
  });
});

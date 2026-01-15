import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { authChallenges } from "~/db";
import { createTestDb, type TestDb } from "./helpers/test-db";

/**
 * auth_challenges テーブルに対する Drizzle ORM クエリの統合テスト
 */
describe("authChallenges Drizzle クエリ", () => {
  let db: TestDb;

  const futureDate = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5分後
  const pastDate = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5分前

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("insert", () => {
    it("登録用チャレンジを作成できる", async () => {
      await db.insert(authChallenges).values({
        id: "challenge-1",
        challenge: "random-challenge-string",
        type: "registration",
        email: "register@example.com",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(authChallenges)
        .where(eq(authChallenges.id, "challenge-1"))
        .get();

      expect(saved).not.toBeNull();
      expect(saved?.challenge).toBe("random-challenge-string");
      expect(saved?.type).toBe("registration");
      expect(saved?.email).toBe("register@example.com");
    });

    it("認証用チャレンジを作成できる", async () => {
      await db.insert(authChallenges).values({
        id: "challenge-auth",
        challenge: "auth-challenge-string",
        type: "authentication",
        email: null,
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(authChallenges)
        .where(eq(authChallenges.id, "challenge-auth"))
        .get();

      expect(saved?.type).toBe("authentication");
      expect(saved?.email).toBeNull();
    });

    it("email なしでも作成できる", async () => {
      await db.insert(authChallenges).values({
        id: "challenge-no-email",
        challenge: "no-email-challenge",
        type: "authentication",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const saved = await db
        .select()
        .from(authChallenges)
        .where(eq(authChallenges.id, "challenge-no-email"))
        .get();

      expect(saved?.email).toBeNull();
    });
  });

  describe("select by id", () => {
    beforeEach(async () => {
      await db.insert(authChallenges).values({
        id: "find-challenge",
        challenge: "find-me",
        type: "registration",
        email: "find@example.com",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("IDでチャレンジを取得できる", async () => {
      const result = await db
        .select()
        .from(authChallenges)
        .where(eq(authChallenges.id, "find-challenge"))
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("find-challenge");
      expect(result?.challenge).toBe("find-me");
    });

    it("存在しないIDの場合はundefinedを返す", async () => {
      const result = await db
        .select()
        .from(authChallenges)
        .where(eq(authChallenges.id, "non-existent"))
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("findValidChallenge", () => {
    it("有効なチャレンジを取得できる", async () => {
      await db.insert(authChallenges).values({
        id: "valid-challenge",
        challenge: "valid-string",
        type: "registration",
        email: "valid@example.com",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const now = new Date().toISOString();
      const result = await db
        .select()
        .from(authChallenges)
        .where(
          and(
            eq(authChallenges.id, "valid-challenge"),
            sql`${authChallenges.expiresAt} > ${now}`,
          ),
        )
        .get();

      expect(result).not.toBeNull();
      expect(result?.id).toBe("valid-challenge");
    });

    it("期限切れのチャレンジは取得できない", async () => {
      await db.insert(authChallenges).values({
        id: "expired-challenge",
        challenge: "expired-string",
        type: "registration",
        email: "expired@example.com",
        expiresAt: pastDate,
        createdAt: "2024-01-01T00:00:00Z",
      });

      const now = new Date().toISOString();
      const result = await db
        .select()
        .from(authChallenges)
        .where(
          and(
            eq(authChallenges.id, "expired-challenge"),
            sql`${authChallenges.expiresAt} > ${now}`,
          ),
        )
        .get();

      expect(result).toBeUndefined();
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await db.insert(authChallenges).values({
        id: "delete-challenge",
        challenge: "delete-me",
        type: "registration",
        email: "delete@example.com",
        expiresAt: futureDate,
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("チャレンジを削除できる", async () => {
      await db
        .delete(authChallenges)
        .where(eq(authChallenges.id, "delete-challenge"));

      const deleted = await db
        .select()
        .from(authChallenges)
        .where(eq(authChallenges.id, "delete-challenge"))
        .get();

      expect(deleted).toBeUndefined();
    });
  });

  describe("deleteExpired", () => {
    beforeEach(async () => {
      await db.insert(authChallenges).values([
        {
          id: "valid-for-cleanup",
          challenge: "valid-cleanup",
          type: "registration",
          expiresAt: futureDate,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "expired-for-cleanup",
          challenge: "expired-cleanup",
          type: "authentication",
          expiresAt: pastDate,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ]);
    });

    it("期限切れのチャレンジのみ削除できる", async () => {
      const now = new Date().toISOString();
      await db
        .delete(authChallenges)
        .where(sql`${authChallenges.expiresAt} < ${now}`);

      const remaining = await db.select().from(authChallenges).all();

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("valid-for-cleanup");
    });
  });

  describe("複数チャレンジの管理", () => {
    it("同じメールアドレスで複数のチャレンジを作成できる", async () => {
      await db.insert(authChallenges).values([
        {
          id: "multi-1",
          challenge: "challenge-1",
          type: "registration",
          email: "multi@example.com",
          expiresAt: futureDate,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "multi-2",
          challenge: "challenge-2",
          type: "registration",
          email: "multi@example.com",
          expiresAt: futureDate,
          createdAt: "2024-01-01T01:00:00Z",
        },
      ]);

      const result = await db
        .select()
        .from(authChallenges)
        .where(eq(authChallenges.email, "multi@example.com"))
        .all();

      expect(result).toHaveLength(2);
    });

    it("メールアドレスで古いチャレンジを削除できる", async () => {
      await db.insert(authChallenges).values([
        {
          id: "old-challenge",
          challenge: "old",
          type: "registration",
          email: "cleanup@example.com",
          expiresAt: futureDate,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "new-challenge",
          challenge: "new",
          type: "registration",
          email: "cleanup@example.com",
          expiresAt: futureDate,
          createdAt: "2024-01-02T00:00:00Z",
        },
      ]);

      // 古いチャレンジを削除
      await db
        .delete(authChallenges)
        .where(
          and(
            eq(authChallenges.email, "cleanup@example.com"),
            sql`${authChallenges.id} != 'new-challenge'`,
          ),
        );

      const remaining = await db
        .select()
        .from(authChallenges)
        .where(eq(authChallenges.email, "cleanup@example.com"))
        .all();

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("new-challenge");
    });
  });
});

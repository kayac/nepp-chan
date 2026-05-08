import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "../test-helpers/test-db";

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

vi.mock("~/lib/crypto", () => ({
  generateToken: vi.fn(),
}));

const { adminSessions } = await import("~/db");
const { generateToken } = await import("~/lib/crypto");
const { adminSessionRepository } = await import("./admin-session-repository");

const fakeD1 = {} as D1Database;

describe("adminSessionRepository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    vi.mocked(generateToken).mockReturnValue("mock-token");
  });

  describe("create", () => {
    it("token を生成して 7 日先の expiresAt で挿入する", async () => {
      const before = Date.now();
      const token = await adminSessionRepository.create(fakeD1, "user-1");
      const after = Date.now();

      expect(token).toBe("mock-token");

      const saved = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.token, "mock-token"))
        .get();

      expect(saved).toMatchObject({
        token: "mock-token",
        userId: "user-1",
      });

      const expiresAt = new Date(saved!.expiresAt).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(expiresAt - before).toBeGreaterThanOrEqual(sevenDays - 1000);
      expect(expiresAt - after).toBeLessThanOrEqual(sevenDays + 1000);
    });

    it("複数の userId に対してそれぞれセッションが作れる", async () => {
      vi.mocked(generateToken)
        .mockReturnValueOnce("t1")
        .mockReturnValueOnce("t2");

      await adminSessionRepository.create(fakeD1, "u1");
      await adminSessionRepository.create(fakeD1, "u2");

      const all = await db.select().from(adminSessions);
      expect(all).toHaveLength(2);
    });
  });

  describe("findValid", () => {
    const insertSession = async (overrides: {
      token: string;
      userId?: string;
      expiresAt: string;
    }) => {
      await db.insert(adminSessions).values({
        token: overrides.token,
        userId: overrides.userId ?? "u-1",
        expiresAt: overrides.expiresAt,
        createdAt: new Date().toISOString(),
      });
    };

    it("有効な token で session を返す", async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      await insertSession({ token: "tok-1", expiresAt: future });

      const result = await adminSessionRepository.findValid(fakeD1, "tok-1");

      expect(result).toMatchObject({ token: "tok-1", userId: "u-1" });
    });

    it("期限切れ token は undefined を返す", async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      await insertSession({ token: "tok-expired", expiresAt: past });

      const result = await adminSessionRepository.findValid(
        fakeD1,
        "tok-expired",
      );

      expect(result).toBeUndefined();
    });

    it("存在しない token は undefined を返す", async () => {
      const result = await adminSessionRepository.findValid(fakeD1, "missing");
      expect(result).toBeUndefined();
    });
  });

  describe("deleteByToken", () => {
    it("該当 token のセッションのみ削除する", async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      const now = new Date().toISOString();
      await db.insert(adminSessions).values([
        { token: "t1", userId: "u1", expiresAt: future, createdAt: now },
        { token: "t2", userId: "u2", expiresAt: future, createdAt: now },
      ]);

      await adminSessionRepository.deleteByToken(fakeD1, "t1");

      const remaining = await db.select().from(adminSessions);
      expect(remaining.map((r) => r.token)).toEqual(["t2"]);
    });

    it("冪等性: 存在しない token を削除してもエラーにならない", async () => {
      await expect(
        adminSessionRepository.deleteByToken(fakeD1, "ghost"),
      ).resolves.toBeUndefined();
    });
  });

  describe("deleteByUserId", () => {
    it("同一 userId の全セッションを削除する", async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      const now = new Date().toISOString();
      await db.insert(adminSessions).values([
        { token: "t1", userId: "u1", expiresAt: future, createdAt: now },
        { token: "t2", userId: "u1", expiresAt: future, createdAt: now },
        { token: "t3", userId: "u2", expiresAt: future, createdAt: now },
      ]);

      await adminSessionRepository.deleteByUserId(fakeD1, "u1");

      const remaining = await db.select().from(adminSessions);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].userId).toBe("u2");
    });
  });
});

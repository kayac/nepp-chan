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

const { adminInvitationRepository } = await import(
  "./admin-invitation-repository"
);

const fakeD1 = {} as D1Database;

const futureDate = (offsetMs = 7 * 24 * 60 * 60 * 1000) =>
  new Date(Date.now() + offsetMs).toISOString();
const pastDate = (offsetMs = 24 * 60 * 60 * 1000) =>
  new Date(Date.now() - offsetMs).toISOString();

const baseInput = (
  overrides: Partial<
    Parameters<typeof adminInvitationRepository.create>[1]
  > = {},
) => ({
  id: overrides.id ?? "inv-1",
  username: overrides.username ?? "user@example.com",
  token: overrides.token ?? "tok-abc",
  invitedBy: overrides.invitedBy ?? "system",
  role: overrides.role ?? "admin",
  expiresAt: overrides.expiresAt ?? futureDate(),
  usedAt: overrides.usedAt,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
});

describe("adminInvitationRepository", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  describe("create", () => {
    it("入力された id を返し、レコードを挿入する", async () => {
      const id = await adminInvitationRepository.create(fakeD1, baseInput());
      expect(id).toBe("inv-1");

      const found = await adminInvitationRepository.findById(fakeD1, "inv-1");
      expect(found).toMatchObject({
        id: "inv-1",
        username: "user@example.com",
        token: "tok-abc",
        role: "admin",
      });
    });

    it("role 未指定なら admin", async () => {
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({ id: "inv-2", role: undefined }),
      );
      const found = await adminInvitationRepository.findById(fakeD1, "inv-2");
      expect(found?.role).toBe("admin");
    });

    it("usedAt 未指定なら null", async () => {
      await adminInvitationRepository.create(fakeD1, baseInput());
      const found = await adminInvitationRepository.findById(fakeD1, "inv-1");
      expect(found?.usedAt).toBeNull();
    });
  });

  describe("findById / findByToken / findByUsername", () => {
    beforeEach(async () => {
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({ id: "i1", username: "u1", token: "t1" }),
      );
    });

    it("存在する id で取得", async () => {
      const result = await adminInvitationRepository.findById(fakeD1, "i1");
      expect(result?.username).toBe("u1");
    });

    it("存在しない id は null", async () => {
      expect(
        await adminInvitationRepository.findById(fakeD1, "ghost"),
      ).toBeNull();
    });

    it("token で取得", async () => {
      const result = await adminInvitationRepository.findByToken(fakeD1, "t1");
      expect(result?.id).toBe("i1");
    });

    it("存在しない token は null", async () => {
      expect(
        await adminInvitationRepository.findByToken(fakeD1, "ghost-tok"),
      ).toBeNull();
    });

    it("username で取得", async () => {
      const result = await adminInvitationRepository.findByUsername(
        fakeD1,
        "u1",
      );
      expect(result?.token).toBe("t1");
    });

    it("存在しない username は null", async () => {
      expect(
        await adminInvitationRepository.findByUsername(fakeD1, "nobody"),
      ).toBeNull();
    });
  });

  describe("findValidByToken", () => {
    it("未使用 + 期限内なら取得", async () => {
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({ id: "v1", token: "valid-tok" }),
      );
      const result = await adminInvitationRepository.findValidByToken(
        fakeD1,
        "valid-tok",
      );
      expect(result?.id).toBe("v1");
    });

    it("期限切れは null", async () => {
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({
          id: "v2",
          token: "exp-tok",
          expiresAt: pastDate(),
        }),
      );
      expect(
        await adminInvitationRepository.findValidByToken(fakeD1, "exp-tok"),
      ).toBeNull();
    });

    it("使用済みは null", async () => {
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({
          id: "v3",
          token: "used-tok",
          usedAt: new Date().toISOString(),
        }),
      );
      expect(
        await adminInvitationRepository.findValidByToken(fakeD1, "used-tok"),
      ).toBeNull();
    });

    it("存在しない token は null", async () => {
      expect(
        await adminInvitationRepository.findValidByToken(fakeD1, "ghost"),
      ).toBeNull();
    });
  });

  describe("list / listPending", () => {
    beforeEach(async () => {
      // createdAt の前後で並び順を確認できるよう 3 件
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({
          id: "old",
          token: "t-old",
          username: "old",
          createdAt: "2030-01-01T00:00:00Z",
        }),
      );
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({
          id: "mid",
          token: "t-mid",
          username: "mid",
          createdAt: "2030-02-01T00:00:00Z",
        }),
      );
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({
          id: "new",
          token: "t-new",
          username: "new",
          createdAt: "2030-03-01T00:00:00Z",
        }),
      );
    });

    it("list: createdAt 降順で全件", async () => {
      const result = await adminInvitationRepository.list(fakeD1);
      expect(result.map((r) => r.id)).toEqual(["new", "mid", "old"]);
    });

    it("listPending: 未使用 + 期限内のみ", async () => {
      // 1 件を使用済みに、1 件を期限切れに
      await adminInvitationRepository.markUsed(fakeD1, "mid");
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({
          id: "expired",
          token: "t-exp",
          username: "exp",
          expiresAt: pastDate(),
        }),
      );

      const result = await adminInvitationRepository.listPending(fakeD1);
      const ids = result.map((r) => r.id);
      expect(ids).toContain("new");
      expect(ids).toContain("old");
      expect(ids).not.toContain("mid");
      expect(ids).not.toContain("expired");
    });
  });

  describe("markUsed", () => {
    it("usedAt が ISO 文字列でセットされる", async () => {
      await adminInvitationRepository.create(fakeD1, baseInput());

      const before = Date.now();
      await adminInvitationRepository.markUsed(fakeD1, "inv-1");
      const after = Date.now();

      const found = await adminInvitationRepository.findById(fakeD1, "inv-1");
      const usedAtMs = new Date(found!.usedAt!).getTime();
      expect(usedAtMs).toBeGreaterThanOrEqual(before);
      expect(usedAtMs).toBeLessThanOrEqual(after);
    });
  });

  describe("delete", () => {
    it("該当 id のレコードのみ削除", async () => {
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({ id: "a", token: "ta", username: "ua" }),
      );
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({ id: "b", token: "tb", username: "ub" }),
      );

      await adminInvitationRepository.delete(fakeD1, "a");

      expect(await adminInvitationRepository.findById(fakeD1, "a")).toBeNull();
      expect(
        await adminInvitationRepository.findById(fakeD1, "b"),
      ).not.toBeNull();
    });

    it("存在しない id でもエラーにならない（冪等）", async () => {
      await expect(
        adminInvitationRepository.delete(fakeD1, "ghost"),
      ).resolves.toBeUndefined();
    });
  });

  describe("deleteExpired", () => {
    it("期限切れだけ削除する", async () => {
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({
          id: "alive",
          token: "ta",
          username: "alive",
          expiresAt: futureDate(),
        }),
      );
      await adminInvitationRepository.create(
        fakeD1,
        baseInput({
          id: "expired",
          token: "te",
          username: "expired",
          expiresAt: pastDate(),
        }),
      );

      await adminInvitationRepository.deleteExpired(fakeD1);

      expect(
        await adminInvitationRepository.findById(fakeD1, "expired"),
      ).toBeNull();
      expect(
        await adminInvitationRepository.findById(fakeD1, "alive"),
      ).not.toBeNull();
    });
  });
});

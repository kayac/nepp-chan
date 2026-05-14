import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "~/__tests__/helpers/assert-defined";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";

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

const { adminUserRepository } = await import("./admin-user-repository");

const fakeD1 = {} as D1Database;

describe("adminUserRepository", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  describe("create", () => {
    it("入力した id を返し、レコードを挿入する", async () => {
      const id = await adminUserRepository.create(fakeD1, {
        id: "u-1",
        username: "admin01",
        name: "管理者",
        role: "admin",
        passwordHash: "100000:salt:hash",
        createdAt: "2030-01-01T00:00:00Z",
      });
      expect(id).toBe("u-1");

      const found = await adminUserRepository.findById(fakeD1, "u-1");
      expect(found).toMatchObject({
        id: "u-1",
        username: "admin01",
        name: "管理者",
        role: "admin",
      });
    });

    it("name 未指定なら null", async () => {
      await adminUserRepository.create(fakeD1, {
        id: "u-2",
        username: "u2",
        passwordHash: "h",
        createdAt: "2030-01-01T00:00:00Z",
      });
      const found = await adminUserRepository.findById(fakeD1, "u-2");
      expect(found?.name).toBeNull();
    });

    it("role 未指定なら admin がデフォルト", async () => {
      await adminUserRepository.create(fakeD1, {
        id: "u-3",
        username: "u3",
        passwordHash: "h",
        createdAt: "2030-01-01T00:00:00Z",
      });
      const found = await adminUserRepository.findById(fakeD1, "u-3");
      expect(found?.role).toBe("admin");
    });
  });

  describe("findById", () => {
    it("存在しなければ null", async () => {
      expect(await adminUserRepository.findById(fakeD1, "ghost")).toBeNull();
    });
  });

  describe("findByUsername", () => {
    beforeEach(async () => {
      await adminUserRepository.create(fakeD1, {
        id: "u-1",
        username: "alice",
        passwordHash: "h",
        createdAt: "2030-01-01T00:00:00Z",
      });
    });

    it("そのままの username で取得", async () => {
      const result = await adminUserRepository.findByUsername(fakeD1, "alice");
      expect(result?.id).toBe("u-1");
    });

    it("大文字混在は lowercase に正規化されて取得できる", async () => {
      const result = await adminUserRepository.findByUsername(fakeD1, "ALICE");
      expect(result?.id).toBe("u-1");
    });

    it("前後の空白は trim される", async () => {
      const result = await adminUserRepository.findByUsername(
        fakeD1,
        "  alice  ",
      );
      expect(result?.id).toBe("u-1");
    });

    it("存在しない username は null", async () => {
      expect(
        await adminUserRepository.findByUsername(fakeD1, "bob"),
      ).toBeNull();
    });
  });

  describe("list", () => {
    it("全件を返す", async () => {
      await adminUserRepository.create(fakeD1, {
        id: "u-1",
        username: "u1",
        passwordHash: "h",
        createdAt: "2030-01-01T00:00:00Z",
      });
      await adminUserRepository.create(fakeD1, {
        id: "u-2",
        username: "u2",
        passwordHash: "h",
        createdAt: "2030-01-02T00:00:00Z",
      });

      const result = await adminUserRepository.list(fakeD1);
      expect(result).toHaveLength(2);
    });

    it("0 件なら空配列", async () => {
      expect(await adminUserRepository.list(fakeD1)).toEqual([]);
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await adminUserRepository.create(fakeD1, {
        id: "u-1",
        username: "u1",
        name: "old",
        role: "staff",
        passwordHash: "old-hash",
        createdAt: "2030-01-01T00:00:00Z",
      });
    });

    it("name のみ更新", async () => {
      await adminUserRepository.update(fakeD1, "u-1", { name: "new" });
      const found = await adminUserRepository.findById(fakeD1, "u-1");
      expect(found?.name).toBe("new");
      expect(found?.role).toBe("staff");
    });

    it("role と passwordHash を更新", async () => {
      await adminUserRepository.update(fakeD1, "u-1", {
        role: "admin",
        passwordHash: "new-hash",
      });
      const found = await adminUserRepository.findById(fakeD1, "u-1");
      expect(found?.role).toBe("admin");
      expect(found?.passwordHash).toBe("new-hash");
    });

    it("updatedAt が更新される", async () => {
      const before = Date.now();
      await adminUserRepository.update(fakeD1, "u-1", { name: "x" });
      const after = Date.now();

      const found = await adminUserRepository.findById(fakeD1, "u-1");
      assertDefined(found);
      assertDefined(found.updatedAt);
      const ms = new Date(found.updatedAt).getTime();
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(after);
    });
  });

  describe("delete", () => {
    it("該当 id のみ削除", async () => {
      await adminUserRepository.create(fakeD1, {
        id: "u-1",
        username: "u1",
        passwordHash: "h",
        createdAt: "2030-01-01T00:00:00Z",
      });
      await adminUserRepository.create(fakeD1, {
        id: "u-2",
        username: "u2",
        passwordHash: "h",
        createdAt: "2030-01-01T00:00:00Z",
      });

      await adminUserRepository.delete(fakeD1, "u-1");

      expect(await adminUserRepository.findById(fakeD1, "u-1")).toBeNull();
      expect(await adminUserRepository.findById(fakeD1, "u-2")).not.toBeNull();
    });

    it("存在しない id でも throw しない", async () => {
      await expect(
        adminUserRepository.delete(fakeD1, "ghost"),
      ).resolves.toBeUndefined();
    });
  });
});

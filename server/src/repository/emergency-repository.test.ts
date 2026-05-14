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

const { emergencyRepository } = await import("./emergency-repository");

const fakeD1 = {} as D1Database;

const baseInput = (
  overrides: Partial<{
    id: string;
    type: string;
    description: string | null;
    location: string | null;
    reportedAt: string;
  }> = {},
) => ({
  id: overrides.id ?? "e-1",
  type: overrides.type ?? "fire",
  description: overrides.description ?? "山火事です",
  location: overrides.location ?? "音威子府村",
  reportedAt: overrides.reportedAt ?? "2030-01-15T12:00:00Z",
});

describe("emergencyRepository", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  describe("create", () => {
    it("入力した id を返し、レコードを挿入する", async () => {
      const id = await emergencyRepository.create(fakeD1, baseInput());
      expect(id).toBe("e-1");

      const found = await emergencyRepository.findById(fakeD1, "e-1");
      expect(found).toMatchObject({
        id: "e-1",
        type: "fire",
        description: "山火事です",
        location: "音威子府村",
      });
    });

    it("description / location 未指定でも null で挿入できる", async () => {
      await emergencyRepository.create(fakeD1, {
        id: "e-min",
        type: "fire",
        reportedAt: "2030-01-15T12:00:00Z",
      });
      const found = await emergencyRepository.findById(fakeD1, "e-min");
      expect(found?.description).toBeNull();
      expect(found?.location).toBeNull();
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await emergencyRepository.create(fakeD1, baseInput());
    });

    it("description だけ更新できる", async () => {
      await emergencyRepository.update(fakeD1, "e-1", {
        description: "更新後の説明",
      });
      const found = await emergencyRepository.findById(fakeD1, "e-1");
      expect(found?.description).toBe("更新後の説明");
      expect(found?.location).toBe("音威子府村");
    });

    it("location だけ更新できる", async () => {
      await emergencyRepository.update(fakeD1, "e-1", { location: "別の場所" });
      const found = await emergencyRepository.findById(fakeD1, "e-1");
      expect(found?.location).toBe("別の場所");
      expect(found?.description).toBe("山火事です");
    });

    it("更新で updatedAt が今の時刻に近い ISO でセットされる", async () => {
      const before = Date.now();
      await emergencyRepository.update(fakeD1, "e-1", { location: "x" });
      const after = Date.now();

      const found = await emergencyRepository.findById(fakeD1, "e-1");
      assertDefined(found);
      assertDefined(found.updatedAt);
      const ms = new Date(found.updatedAt).getTime();
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(after);
    });
  });

  describe("findById", () => {
    it("存在しなければ null", async () => {
      expect(await emergencyRepository.findById(fakeD1, "ghost")).toBeNull();
    });
  });

  describe("findAll", () => {
    it("reportedAt 降順で取得", async () => {
      await emergencyRepository.create(
        fakeD1,
        baseInput({ id: "old", reportedAt: "2030-01-01T00:00:00Z" }),
      );
      await emergencyRepository.create(
        fakeD1,
        baseInput({ id: "new", reportedAt: "2030-03-01T00:00:00Z" }),
      );
      await emergencyRepository.create(
        fakeD1,
        baseInput({ id: "mid", reportedAt: "2030-02-01T00:00:00Z" }),
      );

      const result = await emergencyRepository.findAll(fakeD1);
      expect(result.map((r) => r.id)).toEqual(["new", "mid", "old"]);
    });

    it("limit を適用", async () => {
      for (let i = 0; i < 5; i++) {
        await emergencyRepository.create(
          fakeD1,
          baseInput({
            id: `e-${i}`,
            reportedAt: `2030-01-0${i + 1}T00:00:00Z`,
          }),
        );
      }
      const result = await emergencyRepository.findAll(fakeD1, 2);
      expect(result).toHaveLength(2);
    });

    it("0 件なら空配列", async () => {
      expect(await emergencyRepository.findAll(fakeD1)).toEqual([]);
    });
  });

  describe("findRecent", () => {
    it("days 内の reportedAt のみ取得", async () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      const old = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      await emergencyRepository.create(
        fakeD1,
        baseInput({ id: "recent", reportedAt: recent.toISOString() }),
      );
      await emergencyRepository.create(
        fakeD1,
        baseInput({ id: "old", reportedAt: old.toISOString() }),
      );

      const result = await emergencyRepository.findRecent(fakeD1, 7);
      expect(result.map((r) => r.id)).toEqual(["recent"]);
    });

    it("limit を適用", async () => {
      const now = new Date();
      for (let i = 0; i < 3; i++) {
        const t = new Date(now.getTime() - i * 60 * 1000);
        await emergencyRepository.create(
          fakeD1,
          baseInput({ id: `e-${i}`, reportedAt: t.toISOString() }),
        );
      }
      const result = await emergencyRepository.findRecent(fakeD1, 7, 2);
      expect(result).toHaveLength(2);
    });
  });
});

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

const { personaRepository } = await import("./persona-repository");

const fakeD1 = {} as D1Database;

type CreateOverrides = {
  id?: string;
  category?: string;
  tags?: string | null;
  content?: string;
  source?: string | null;
  topic?: string | null;
  sentiment?: string | null;
  demographicSummary?: string | null;
  createdAt?: string;
  conversationEndedAt?: string | null;
};

const baseInput = (overrides: CreateOverrides = {}) => ({
  id: overrides.id ?? "p-1",
  category: overrides.category ?? "preference",
  tags: "tags" in overrides ? (overrides.tags ?? null) : "tag1,tag2",
  content: overrides.content ?? "好きな食べ物はラーメン",
  source: "source" in overrides ? (overrides.source ?? null) : "chat",
  topic: "topic" in overrides ? (overrides.topic ?? null) : "food",
  sentiment:
    "sentiment" in overrides ? (overrides.sentiment ?? null) : "positive",
  demographicSummary:
    "demographicSummary" in overrides
      ? (overrides.demographicSummary ?? null)
      : "20代,男性",
  createdAt: overrides.createdAt ?? "2030-01-01T00:00:00Z",
  conversationEndedAt:
    "conversationEndedAt" in overrides
      ? (overrides.conversationEndedAt ?? null)
      : null,
});

describe("personaRepository", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  describe("create", () => {
    it("入力した id を返し、レコードを挿入する", async () => {
      const id = await personaRepository.create(fakeD1, baseInput());
      expect(id).toBe("p-1");

      const found = await personaRepository.findById(fakeD1, "p-1");
      expect(found).toMatchObject({
        id: "p-1",
        category: "preference",
        topic: "food",
        sentiment: "positive",
      });
    });

    it("sentiment 未指定は 'neutral' がデフォルト", async () => {
      await personaRepository.create(fakeD1, {
        id: "p-min",
        category: "preference",
        content: "x",
        createdAt: "2030-01-01T00:00:00Z",
      });
      const found = await personaRepository.findById(fakeD1, "p-min");
      expect(found?.sentiment).toBe("neutral");
    });

    it("optional フィールド未指定なら null", async () => {
      await personaRepository.create(fakeD1, {
        id: "p-min",
        category: "preference",
        content: "x",
        createdAt: "2030-01-01T00:00:00Z",
      });
      const found = await personaRepository.findById(fakeD1, "p-min");
      expect(found?.tags).toBeNull();
      expect(found?.source).toBeNull();
      expect(found?.topic).toBeNull();
      expect(found?.demographicSummary).toBeNull();
      expect(found?.conversationEndedAt).toBeNull();
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await personaRepository.create(fakeD1, baseInput());
    });

    it("category だけ更新", async () => {
      await personaRepository.update(fakeD1, "p-1", { category: "interest" });
      const found = await personaRepository.findById(fakeD1, "p-1");
      expect(found?.category).toBe("interest");
      expect(found?.topic).toBe("food");
    });

    it("複数フィールド同時更新", async () => {
      await personaRepository.update(fakeD1, "p-1", {
        topic: "music",
        sentiment: "negative",
        content: "ラーメン苦手",
      });
      const found = await personaRepository.findById(fakeD1, "p-1");
      expect(found?.topic).toBe("music");
      expect(found?.sentiment).toBe("negative");
      expect(found?.content).toBe("ラーメン苦手");
    });

    it("updatedAt が今の時刻でセットされる", async () => {
      const before = Date.now();
      await personaRepository.update(fakeD1, "p-1", { topic: "x" });
      const after = Date.now();

      const found = await personaRepository.findById(fakeD1, "p-1");
      assertDefined(found);
      assertDefined(found.updatedAt);
      const ms = new Date(found.updatedAt).getTime();
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(after);
    });
  });

  describe("findById", () => {
    it("存在しなければ null", async () => {
      expect(await personaRepository.findById(fakeD1, "ghost")).toBeNull();
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({
          id: "p-1",
          category: "preference",
          tags: "music,rock",
          content: "ロックが好き",
          createdAt: "2030-01-01T00:00:00Z",
        }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({
          id: "p-2",
          category: "interest",
          tags: "food,ramen",
          content: "ラーメンが好き",
          createdAt: "2030-01-02T00:00:00Z",
        }),
      );
    });

    it("フィルタ無しなら全件 createdAt 降順", async () => {
      const result = await personaRepository.search(fakeD1);
      expect(result.map((p) => p.id)).toEqual(["p-2", "p-1"]);
    });

    it("category フィルタが効く", async () => {
      const result = await personaRepository.search(fakeD1, {
        category: "interest",
      });
      expect(result.map((p) => p.id)).toEqual(["p-2"]);
    });

    it("tags フィルタは OR 検索", async () => {
      const result = await personaRepository.search(fakeD1, {
        tags: ["rock", "ramen"],
      });
      expect(result.map((p) => p.id).sort()).toEqual(["p-1", "p-2"]);
    });

    it("keyword 1 語は LIKE 検索", async () => {
      const result = await personaRepository.search(fakeD1, {
        keyword: "ラーメン",
      });
      expect(result.map((p) => p.id)).toEqual(["p-2"]);
    });

    it("keyword 複数語は OR 検索", async () => {
      const result = await personaRepository.search(fakeD1, {
        keyword: "ロック ラーメン",
      });
      expect(result.map((p) => p.id).sort()).toEqual(["p-1", "p-2"]);
    });

    it("keyword 空白だけは効かない（フィルタなし扱い）", async () => {
      const result = await personaRepository.search(fakeD1, {
        keyword: "   ",
      });
      expect(result).toHaveLength(2);
    });

    it("limit を適用", async () => {
      const result = await personaRepository.search(fakeD1, { limit: 1 });
      expect(result).toHaveLength(1);
    });
  });

  describe("aggregateByTopic", () => {
    it("topic + category でグルーピングし件数降順", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", topic: "food", category: "preference" }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-2", topic: "food", category: "preference" }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-3", topic: "music", category: "preference" }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-no", topic: null }),
      );

      const result = await personaRepository.aggregateByTopic(fakeD1);
      expect(result[0]).toMatchObject({ topic: "food", count: 2 });
      expect(result[1]).toMatchObject({ topic: "music", count: 1 });
      // topic=null は除外
      expect(result.find((r) => r.topic === null)).toBeUndefined();
    });

    it("category フィルタが効く", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", topic: "food", category: "preference" }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-2", topic: "food", category: "complaint" }),
      );
      const result = await personaRepository.aggregateByTopic(fakeD1, {
        category: "complaint",
      });
      expect(result.every((r) => r.category === "complaint")).toBe(true);
    });
  });

  describe("delete / deleteAll", () => {
    beforeEach(async () => {
      await personaRepository.create(fakeD1, baseInput({ id: "p-1" }));
      await personaRepository.create(fakeD1, baseInput({ id: "p-2" }));
    });

    it("delete: 該当のみ", async () => {
      await personaRepository.delete(fakeD1, "p-1");
      expect(await personaRepository.findById(fakeD1, "p-1")).toBeNull();
      expect(await personaRepository.findById(fakeD1, "p-2")).not.toBeNull();
    });

    it("deleteAll: 全件削除", async () => {
      await personaRepository.deleteAll(fakeD1);
      const stats = await personaRepository.getStats(fakeD1);
      expect(stats.total).toBe(0);
    });
  });

  describe("list", () => {
    const seed = async () => {
      for (let i = 0; i < 5; i++) {
        await personaRepository.create(
          fakeD1,
          baseInput({
            id: `p-${i}`,
            category: i % 2 === 0 ? "preference" : "interest",
            sentiment: i < 3 ? "positive" : "negative",
            createdAt: `2030-01-0${i + 1}T00:00:00Z`,
          }),
        );
      }
    };

    it("デフォルトで createdAt 降順最大 30 件", async () => {
      await seed();
      const result = await personaRepository.list(fakeD1);
      expect(result.personas[0].id).toBe("p-4");
      expect(result.hasMore).toBe(false);
    });

    it("limit + cursor 動作", async () => {
      await seed();
      const first = await personaRepository.list(fakeD1, { limit: 2 });
      expect(first.personas).toHaveLength(2);
      expect(first.hasMore).toBe(true);
      expect(first.nextCursor).toBeTruthy();

      assertDefined(first.nextCursor);
      const next = await personaRepository.list(fakeD1, {
        limit: 2,
        cursor: first.nextCursor,
      });
      expect(next.personas[0].id).toBe("p-2");
    });

    it("category / sentiment フィルタ", async () => {
      await seed();
      const result = await personaRepository.list(fakeD1, {
        category: "preference",
        sentiment: "positive",
      });
      const ids = result.personas.map((p) => p.id);
      expect(ids).toEqual(["p-2", "p-0"]);
    });
  });

  describe("listForAdmin", () => {
    it("createdAt + id の複合ソートとカーソル", async () => {
      // 同じ createdAt で id が違う persona を作る
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-a", createdAt: "2030-01-01T00:00:00Z" }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-b", createdAt: "2030-01-01T00:00:00Z" }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-c", createdAt: "2030-02-01T00:00:00Z" }),
      );

      const first = await personaRepository.listForAdmin(fakeD1, { limit: 1 });
      expect(first.personas[0].id).toBe("p-c");
      expect(first.total).toBe(3);
      expect(first.hasMore).toBe(true);

      assertDefined(first.nextCursor);
      const next = await personaRepository.listForAdmin(fakeD1, {
        limit: 1,
        cursor: first.nextCursor,
      });
      // 同 createdAt なら id 降順
      expect(next.personas[0].id).toBe("p-b");
    });
  });

  describe("getStats", () => {
    it("空のとき全部 0 / 空オブジェクト", async () => {
      const stats = await personaRepository.getStats(fakeD1);
      expect(stats).toEqual({ total: 0, byCategory: {}, bySentiment: {} });
    });

    it("カテゴリ・センチメントの集計", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", category: "preference", sentiment: "positive" }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-2", category: "preference", sentiment: "negative" }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-3", category: "interest", sentiment: "positive" }),
      );

      const stats = await personaRepository.getStats(fakeD1);
      expect(stats.total).toBe(3);
      expect(stats.byCategory).toEqual({ preference: 2, interest: 1 });
      expect(stats.bySentiment).toEqual({ positive: 2, negative: 1 });
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

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
      const ms = new Date(found!.updatedAt!).getTime();
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

      const next = await personaRepository.list(fakeD1, {
        limit: 2,
        cursor: first.nextCursor!,
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

  describe("listForAdmin フィルター", () => {
    const seedVoices = async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({
          id: "v-1",
          topic: "観光",
          sentiment: "positive",
          tags: "そば,駅",
          demographicSummary: "30代,観光客",
          createdAt: "2030-01-05T00:00:00Z",
          conversationEndedAt: "2030-01-10T00:00:00Z",
        }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({
          id: "v-2",
          topic: "生活",
          sentiment: "negative",
          tags: "ゴミ分別,村人",
          demographicSummary: "40代",
          createdAt: "2030-01-06T00:00:00Z",
          conversationEndedAt: "2030-01-20T00:00:00Z",
        }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({
          id: "v-3",
          topic: "行政",
          sentiment: "request",
          tags: "補助金",
          demographicSummary: "50代,移住検討者",
          createdAt: "2030-02-01T00:00:00Z",
          conversationEndedAt: null,
        }),
      );
    };

    it("from/to は conversationEndedAt（null なら createdAt）基準", async () => {
      await seedVoices();
      const result = await personaRepository.listForAdmin(fakeD1, {
        from: "2030-01-15T00:00:00Z",
        to: "2030-02-15T00:00:00Z",
      });
      // v-2 は会話終了 2030-01-20、v-3 は createdAt 2030-02-01 にフォールバック
      expect(result.personas.map((p) => p.id).sort()).toEqual(["v-2", "v-3"]);
    });

    it("total は期間フィルター適用後の件数", async () => {
      await seedVoices();
      const result = await personaRepository.listForAdmin(fakeD1, {
        from: "2030-01-15T00:00:00Z",
      });
      expect(result.total).toBe(2);
    });

    it("期間フィルターとカーソルの併用", async () => {
      await seedVoices();
      const first = await personaRepository.listForAdmin(fakeD1, {
        from: "2030-01-15T00:00:00Z",
        limit: 1,
      });
      expect(first.personas.map((p) => p.id)).toEqual(["v-3"]);
      expect(first.hasMore).toBe(true);
      expect(first.total).toBe(2);

      const next = await personaRepository.listForAdmin(fakeD1, {
        from: "2030-01-15T00:00:00Z",
        limit: 1,
        cursor: first.nextCursor!,
      });
      expect(next.personas.map((p) => p.id)).toEqual(["v-2"]);
      expect(next.hasMore).toBe(false);
    });
  });

  describe("listForAdmin", () => {
    it("conversationEndedAt 優先 + id の複合ソートとカーソル", async () => {
      // conversationEndedAt が null の場合は createdAt にフォールバックして比較する
      await personaRepository.create(
        fakeD1,
        baseInput({
          id: "p-a",
          createdAt: "2030-01-01T00:00:00Z",
          conversationEndedAt: "2030-03-01T00:00:00Z",
        }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({
          id: "p-b",
          createdAt: "2030-01-01T00:00:00Z",
          conversationEndedAt: "2030-03-01T00:00:00Z",
        }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({
          id: "p-c",
          createdAt: "2030-02-15T00:00:00Z",
          conversationEndedAt: null,
        }),
      );

      const first = await personaRepository.listForAdmin(fakeD1, { limit: 1 });
      // p-a / p-b は会話日時 2030-03-01、p-c は会話日時なし → createdAt フォールバック 2030-02-15
      // 同日付なら id 降順なので先頭は p-b
      expect(first.personas[0].id).toBe("p-b");
      expect(first.total).toBe(3);
      expect(first.hasMore).toBe(true);

      const next = await personaRepository.listForAdmin(fakeD1, {
        limit: 1,
        cursor: first.nextCursor!,
      });
      expect(next.personas[0].id).toBe("p-a");

      const last = await personaRepository.listForAdmin(fakeD1, {
        limit: 1,
        cursor: next.nextCursor!,
      });
      expect(last.personas[0].id).toBe("p-c");
      expect(last.hasMore).toBe(false);
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
  describe("topicBreakdown", () => {
    const voice = (
      id: string,
      topic: string | null,
      sentiment: string | null,
      endedAt: string,
    ) =>
      personaRepository.create(
        fakeD1,
        baseInput({
          id,
          topic,
          sentiment,
          content: `${id} の声`,
          conversationEndedAt: endedAt,
          createdAt: endedAt,
        }),
      );

    it("話題ごとに件数と感情内訳を返し、件数降順に並べる", async () => {
      await voice("p-1", "生活", "negative", "2030-01-10T00:00:00Z");
      await voice("p-2", "生活", "request", "2030-01-11T00:00:00Z");
      await voice("p-3", "観光", "positive", "2030-01-12T00:00:00Z");

      const result = await personaRepository.topicBreakdown(fakeD1);

      expect(result[0]).toMatchObject({
        topic: "生活",
        total: 2,
        sentiments: { negative: 1, request: 1, positive: 0, neutral: 0 },
      });
      expect(result[1]).toMatchObject({ topic: "観光", total: 1 });
    });

    it("NULL と未知の話題は その他 に寄せる", async () => {
      await voice("p-null", null, "neutral", "2030-01-10T00:00:00Z");
      await voice(
        "p-unknown",
        "ふるさと納税",
        "neutral",
        "2030-01-11T00:00:00Z",
      );

      const result = await personaRepository.topicBreakdown(fakeD1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ topic: "その他", total: 2 });
    });

    it("感情が NULL や未知の値なら neutral に数える", async () => {
      await voice("p-null", "生活", null, "2030-01-10T00:00:00Z");
      await voice("p-unknown", "生活", "angry", "2030-01-11T00:00:00Z");

      const result = await personaRepository.topicBreakdown(fakeD1);

      expect(result[0].sentiments.neutral).toBe(2);
    });

    it("代表的な声は話題ごとの最新1件", async () => {
      await voice("p-old", "生活", "negative", "2030-01-10T00:00:00Z");
      await voice("p-new", "生活", "negative", "2030-01-20T00:00:00Z");

      const result = await personaRepository.topicBreakdown(fakeD1);

      expect(result[0].sample).toBe("p-new の声");
    });

    it("期間で絞り込める", async () => {
      await voice("p-in", "生活", "negative", "2030-02-01T00:00:00Z");
      await voice("p-out", "観光", "positive", "2030-01-01T00:00:00Z");

      const result = await personaRepository.topicBreakdown(fakeD1, {
        from: "2030-01-15T00:00:00Z",
      });

      expect(result.map((r) => r.topic)).toEqual(["生活"]);
    });

    it("感情で絞り込める", async () => {
      await voice("p-neg", "生活", "negative", "2030-01-10T00:00:00Z");
      await voice("p-pos", "生活", "positive", "2030-01-11T00:00:00Z");

      const result = await personaRepository.topicBreakdown(fakeD1, {
        sentiments: ["negative"],
      });

      expect(result[0]).toMatchObject({ topic: "生活", total: 1 });
    });

    it("その他 で絞ると NULL と未知の話題だけが残る", async () => {
      await voice("p-null", null, "neutral", "2030-01-10T00:00:00Z");
      await voice("p-known", "生活", "neutral", "2030-01-11T00:00:00Z");

      const result = await personaRepository.topicBreakdown(fakeD1, {
        topic: "その他",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ topic: "その他", total: 1 });
    });

    it("該当がなければ空配列", async () => {
      expect(await personaRepository.topicBreakdown(fakeD1)).toEqual([]);
    });

    it("topTags に話題別の頻出タグを件数降順で上位3件返す", async () => {
      const tagged = (id: string, tags: string | null) =>
        personaRepository.create(
          fakeD1,
          baseInput({
            id,
            topic: "観光",
            tags,
            createdAt: "2030-01-10T00:00:00Z",
          }),
        );
      await tagged("p-1", "そば,駅");
      await tagged("p-2", "そば,天塩川");
      await tagged("p-3", "そば, 駅 ,クラフト");
      await tagged("p-4", null);

      const result = await personaRepository.topicBreakdown(fakeD1);

      expect(result[0].topTags).toEqual([
        { tag: "そば", count: 3 },
        { tag: "駅", count: 2 },
        { tag: "クラフト", count: 1 },
      ]);
    });

    it("タグを持つ声がない話題の topTags は空配列", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", topic: "生活", tags: null }),
      );

      const result = await personaRepository.topicBreakdown(fakeD1);

      expect(result[0].topTags).toEqual([]);
    });
  });

  describe("listCreatedBetween", () => {
    it("createdAt が期間内の声だけを返す", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", createdAt: "2030-01-01T00:00:00Z" }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-2", createdAt: "2030-01-08T00:00:00Z" }),
      );

      const result = await personaRepository.listCreatedBetween(fakeD1, {
        from: "2030-01-01T00:00:00Z",
        to: "2030-01-08T00:00:00Z",
      });

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("好きな食べ物はラーメン");
    });
  });

  describe("listAttributes", () => {
    it("期間指定が無ければ会話終了時刻が無い声も含める", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", conversationEndedAt: null }),
      );

      expect(await personaRepository.listAttributes(fakeD1)).toHaveLength(1);
    });

    it("会話終了時刻で期間を絞る", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", conversationEndedAt: "2030-01-02T00:00:00Z" }),
      );
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-2", conversationEndedAt: "2030-01-09T00:00:00Z" }),
      );

      const result = await personaRepository.listAttributes(fakeD1, {
        from: "2030-01-01T00:00:00Z",
        to: "2030-01-08T00:00:00Z",
      });

      expect(result).toHaveLength(1);
    });
  });

  describe("countByConversationHour", () => {
    it("JST の時刻で集計する", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", conversationEndedAt: "2030-01-02T00:30:00Z" }),
      );

      expect(await personaRepository.countByConversationHour(fakeD1)).toEqual([
        { hour: 9, count: 1 },
      ]);
    });

    it("会話終了時刻が無い声は数えない", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", conversationEndedAt: null }),
      );

      expect(await personaRepository.countByConversationHour(fakeD1)).toEqual(
        [],
      );
    });
  });

  describe("countByConversationWeekday", () => {
    it("JST の曜日で集計する", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", conversationEndedAt: "2030-01-05T15:00:00Z" }),
      );

      expect(
        await personaRepository.countByConversationWeekday(fakeD1),
      ).toEqual([{ dow: 0, count: 1 }]);
    });
  });

  describe("countOfficeHours", () => {
    it("平日 8〜17 時 JST を開庁として数える", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", conversationEndedAt: "2030-01-02T00:00:00Z" }),
      );

      expect(await personaRepository.countOfficeHours(fakeD1)).toEqual({
        open: 1,
        total: 1,
      });
    });

    it("平日でも 17 時以降は閉庁として数える", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", conversationEndedAt: "2030-01-02T08:00:00Z" }),
      );

      expect(await personaRepository.countOfficeHours(fakeD1)).toEqual({
        open: 0,
        total: 1,
      });
    });

    it("土日は開庁時間帯でも閉庁として数える", async () => {
      await personaRepository.create(
        fakeD1,
        baseInput({ id: "p-1", conversationEndedAt: "2030-01-06T00:00:00Z" }),
      );

      expect(await personaRepository.countOfficeHours(fakeD1)).toEqual({
        open: 0,
        total: 1,
      });
    });
  });
});

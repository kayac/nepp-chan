import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { llmUsage, type NewLlmUsage } from "~/db";

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

const { llmUsageRepository } = await import("./llm-usage-repository");

const d1 = {} as D1Database;

let seq = 0;

const usageRow = (overrides: Partial<NewLlmUsage> = {}): NewLlmUsage => ({
  id: `usage-${++seq}`,
  model: "gpt-5-mini",
  source: "chat",
  inputTokens: 100,
  outputTokens: 200,
  reasoningTokens: 0,
  cachedInputTokens: 0,
  totalTokens: 300,
  costUsd: 0.001,
  createdAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

const insert = async (db: TestDb, overrides: Partial<NewLlmUsage> = {}) => {
  await db.insert(llmUsage).values(usageRow(overrides));
};

describe("llmUsageRepository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  describe("create", () => {
    it("記録した行を取得できる", async () => {
      await llmUsageRepository.create(d1, usageRow({ model: "gpt-5.6" }));

      const rows = await db.select().from(llmUsage).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.model).toBe("gpt-5.6");
    });
  });

  describe("countChatByThread", () => {
    it("同一スレッドの source='chat' だけを数える", async () => {
      await insert(db, { threadId: "t-1", source: "chat" });
      await insert(db, { threadId: "t-1", source: "chat" });
      await insert(db, { threadId: "t-1", source: "subagent" });
      await insert(db, { threadId: "t-2", source: "chat" });

      expect(await llmUsageRepository.countChatByThread(d1, "t-1")).toBe(2);
    });

    it("該当行が無ければ 0 を返す", async () => {
      expect(await llmUsageRepository.countChatByThread(d1, "none")).toBe(0);
    });
  });

  describe("sumByDateAndModel", () => {
    it("JST の日付でグループ化する", async () => {
      await insert(db, { createdAt: "2026-06-01T14:59:00.000Z" });
      await insert(db, { createdAt: "2026-06-01T15:00:00.000Z" });

      const rows = await llmUsageRepository.sumByDateAndModel(d1, {
        from: "2026-06-01T00:00:00.000Z",
      });

      expect(rows.map((r) => r.date)).toEqual(["2026-06-01", "2026-06-02"]);
    });

    it("to を渡すと期間の上限が効く", async () => {
      await insert(db, { createdAt: "2026-06-01T00:00:00.000Z" });
      await insert(db, { createdAt: "2026-06-10T00:00:00.000Z" });

      const rows = await llmUsageRepository.sumByDateAndModel(d1, {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-02T00:00:00.000Z",
      });

      expect(rows).toHaveLength(1);
    });

    it("cost_usd が NULL の行のトークンを legacy 列に振り分ける", async () => {
      await insert(db, { costUsd: null, inputTokens: 10, outputTokens: 20 });
      await insert(db, { costUsd: 0.5, inputTokens: 30, outputTokens: 40 });

      const [row] = await llmUsageRepository.sumByDateAndModel(d1, {
        from: "2026-06-01T00:00:00.000Z",
      });

      expect(Number(row?.inputTokens)).toBe(40);
      expect(Number(row?.legacyInputTokens)).toBe(10);
      expect(Number(row?.legacyOutputTokens)).toBe(20);
      expect(Number(row?.persistedCostUsd)).toBe(0.5);
    });
  });

  describe("sumByModel", () => {
    it("期間外の行を除外してモデル別に合算する", async () => {
      await insert(db, { model: "a", createdAt: "2026-06-01T00:00:00.000Z" });
      await insert(db, { model: "a", createdAt: "2026-06-02T00:00:00.000Z" });
      await insert(db, { model: "b", createdAt: "2026-06-09T00:00:00.000Z" });

      const rows = await llmUsageRepository.sumByModel(d1, {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-08T00:00:00.000Z",
      });

      expect(rows).toHaveLength(1);
      expect(rows[0]?.model).toBe("a");
      expect(Number(rows[0]?.totalTokens)).toBe(600);
    });
  });

  describe("sumByCategory", () => {
    const period = {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-08T00:00:00.000Z",
    };

    it("source が会話系なら conversation に分類する", async () => {
      await insert(db, { source: "subagent" });

      const [row] = await llmUsageRepository.sumByCategory(d1, period);
      expect(row?.category).toBe("conversation");
    });

    it("embedding はスレッドに紐づくときだけ conversation に分類する", async () => {
      await insert(db, { source: "embedding", threadId: "t-1" });
      await insert(db, { source: "embedding", threadId: null });

      const rows = await llmUsageRepository.sumByCategory(d1, period);
      expect(new Set(rows.map((r) => r.category))).toEqual(
        new Set(["conversation", "knowledge-base"]),
      );
    });

    it("curated-draft はナレッジ基盤の費用として knowledge-base に分類する", async () => {
      await insert(db, { source: "curated-draft" });

      const [row] = await llmUsageRepository.sumByCategory(d1, period);
      expect(row?.category).toBe("knowledge-base");
    });

    it("会話にも埋め込みにも当たらない source は batch に分類する", async () => {
      await insert(db, { source: "weekly-report" });

      const [row] = await llmUsageRepository.sumByCategory(d1, period);
      expect(row?.category).toBe("batch");
    });
  });

  describe("sumConversationByThread", () => {
    const period = {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-08T00:00:00.000Z",
    };

    it("batch の行とスレッド無しの行を除外する", async () => {
      await insert(db, { threadId: "t-1", source: "chat" });
      await insert(db, { threadId: "t-2", source: "weekly-report" });
      await insert(db, { threadId: null, source: "chat" });

      const rows = await llmUsageRepository.sumConversationByThread(d1, period);

      expect(rows.map((r) => r.threadId)).toEqual(["t-1"]);
    });

    it("chatCalls は source='chat' の件数だけを数える", async () => {
      await insert(db, { threadId: "t-1", source: "chat" });
      await insert(db, { threadId: "t-1", source: "chat" });
      await insert(db, { threadId: "t-1", source: "subagent" });

      const [row] = await llmUsageRepository.sumConversationByThread(
        d1,
        period,
      );

      expect(Number(row?.chatCalls)).toBe(2);
      expect(Number(row?.totalTokens)).toBe(900);
    });
  });

  describe("sumConversationByTurn", () => {
    it("duration と応答時刻は source='chat' の行から取る", async () => {
      await insert(db, {
        threadId: "t-1",
        source: "chat",
        turnIndex: 1,
        durationMs: 100,
        createdAt: "2026-06-01T00:00:00.000Z",
      });
      await insert(db, {
        threadId: "t-1",
        source: "subagent",
        turnIndex: 1,
        durationMs: 9999,
        createdAt: "2026-06-01T01:00:00.000Z",
      });

      const [row] = await llmUsageRepository.sumConversationByTurn(d1, "t-1");

      expect(Number(row?.durationMs)).toBe(100);
      expect(row?.answeredAt).toBe("2026-06-01T00:00:00.000Z");
    });

    it("ターン順に並べる", async () => {
      await insert(db, { threadId: "t-1", source: "chat", turnIndex: 2 });
      await insert(db, { threadId: "t-1", source: "chat", turnIndex: 1 });

      const rows = await llmUsageRepository.sumConversationByTurn(d1, "t-1");

      expect(rows.map((r) => Number(r.turnIndex))).toEqual([1, 2]);
    });
  });

  describe("deleteCreatedBefore", () => {
    it("期限より前の行を削除する", async () => {
      await insert(db, { createdAt: "2026-01-01T00:00:00.000Z" });
      await insert(db, { createdAt: "2026-06-01T00:00:00.000Z" });

      const deleted = await llmUsageRepository.deleteCreatedBefore(
        d1,
        "2026-03-01T00:00:00.000Z",
      );

      expect(deleted).toBe(1);
      expect(await db.select().from(llmUsage).all()).toHaveLength(1);
    });
  });
});

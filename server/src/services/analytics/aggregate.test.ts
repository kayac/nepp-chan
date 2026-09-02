import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { llmUsage, mastraMessages, mastraThreads, persona } from "~/db";

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

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const {
  getConversationStats,
  getDailyUsage,
  getUsageByModel,
  getThreadUsage,
  getThreadTurnUsage,
  getOperationCost,
  getPersonaAnalytics,
} = await import("./aggregate");

const d1 = {} as D1Database;

const WEB_RESOURCE = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const insertThread = async (db: TestDb, id: string, resourceId: string) => {
  await db.insert(mastraThreads).values({
    id,
    resourceId,
    createdAt: "2026-06-01T00:00:00.000Z",
  });
};

const insertMessage = async (
  db: TestDb,
  params: { id: string; threadId: string; role?: string; createdAt: string },
) => {
  await db.insert(mastraMessages).values({
    id: params.id,
    threadId: params.threadId,
    role: params.role ?? "user",
    createdAt: params.createdAt,
  });
};

describe("getConversationStats", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("UTC 23:30 のメッセージは JST 翌日 8 時台として集計される", async () => {
    await insertThread(db, "t1", WEB_RESOURCE);
    await insertMessage(db, {
      id: "m1",
      threadId: "t1",
      createdAt: "2026-06-08T23:30:00.000Z", // JST 2026-06-09 08:30
    });

    const stats = await getConversationStats(d1, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-15T00:00:00.000Z",
    });

    expect(stats.hourly[8]).toEqual({ hour: 8, count: 1 });
    expect(stats.daily).toEqual([
      { date: "2026-06-09", conversations: 1, messages: 1 },
    ]);
  });

  it("hourly は 0〜23 時の 24 要素を常に返す", async () => {
    const stats = await getConversationStats(d1, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-15T00:00:00.000Z",
    });

    expect(stats.hourly).toHaveLength(24);
    expect(stats.hourly[0]).toEqual({ hour: 0, count: 0 });
    expect(stats.hourly[23]).toEqual({ hour: 23, count: 0 });
  });

  it("weekday は JST の曜日（0=日〜6=土）で集計し 7 要素を常に返す", async () => {
    await insertThread(db, "t1", WEB_RESOURCE);
    await insertMessage(db, {
      id: "m1",
      threadId: "t1",
      createdAt: "2026-06-12T10:00:00.000Z", // JST 06-12（金）19:00 → dow 5
    });
    await insertMessage(db, {
      id: "m2",
      threadId: "t1",
      createdAt: "2026-06-12T16:00:00.000Z", // JST 06-13（土）01:00 → dow 6
    });

    const stats = await getConversationStats(d1, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-15T00:00:00.000Z",
    });

    expect(stats.weekday).toHaveLength(7);
    expect(stats.weekday[5]).toEqual({ dow: 5, count: 1 });
    expect(stats.weekday[6]).toEqual({ dow: 6, count: 1 });
    expect(stats.weekday[0]).toEqual({ dow: 0, count: 0 });
  });

  it("UTC 15:00 直前/直後で JST の日付が分かれる", async () => {
    await insertThread(db, "t1", WEB_RESOURCE);
    await insertMessage(db, {
      id: "m1",
      threadId: "t1",
      createdAt: "2026-06-09T14:59:59.000Z", // JST 06-09 23:59
    });
    await insertMessage(db, {
      id: "m2",
      threadId: "t1",
      createdAt: "2026-06-09T15:00:00.000Z", // JST 06-10 00:00
    });

    const stats = await getConversationStats(d1, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-15T00:00:00.000Z",
    });

    expect(stats.daily.map((d) => d.date)).toEqual([
      "2026-06-09",
      "2026-06-10",
    ]);
  });

  it("assistant ロールのメッセージは集計に含めない", async () => {
    await insertThread(db, "t1", WEB_RESOURCE);
    await insertMessage(db, {
      id: "m1",
      threadId: "t1",
      role: "assistant",
      createdAt: "2026-06-09T01:00:00.000Z",
    });

    const stats = await getConversationStats(d1, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-15T00:00:00.000Z",
    });

    expect(stats.totals.messages).toBe(0);
  });

  it("期間外のメッセージは集計に含めない", async () => {
    await insertThread(db, "t1", WEB_RESOURCE);
    await insertMessage(db, {
      id: "m1",
      threadId: "t1",
      createdAt: "2026-05-31T23:59:59.000Z",
    });

    const stats = await getConversationStats(d1, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-15T00:00:00.000Z",
    });

    expect(stats.totals.messages).toBe(0);
  });

  it("resourceId プレフィックスで line / admin / widget / web に分類する", async () => {
    await insertThread(db, "t-line", "line:hashed-abc");
    await insertThread(db, "t-admin", "admin:user-1");
    await insertThread(db, "t-widget", "widget-anonymous-1");
    await insertThread(db, "t-web", WEB_RESOURCE);
    await insertMessage(db, {
      id: "m1",
      threadId: "t-line",
      createdAt: "2026-06-09T01:00:00.000Z",
    });
    await insertMessage(db, {
      id: "m2",
      threadId: "t-line",
      createdAt: "2026-06-09T02:00:00.000Z",
    });
    await insertMessage(db, {
      id: "m3",
      threadId: "t-admin",
      createdAt: "2026-06-09T03:00:00.000Z",
    });
    await insertMessage(db, {
      id: "m4",
      threadId: "t-widget",
      createdAt: "2026-06-09T04:00:00.000Z",
    });
    await insertMessage(db, {
      id: "m5",
      threadId: "t-web",
      createdAt: "2026-06-09T05:00:00.000Z",
    });

    const stats = await getConversationStats(d1, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-15T00:00:00.000Z",
    });

    expect(stats.platforms).toEqual(
      expect.arrayContaining([
        { platform: "line", count: 2 },
        { platform: "admin", count: 1 },
        { platform: "widget", count: 1 },
        { platform: "web", count: 1 },
      ]),
    );
  });

  it("totals は distinct スレッド数とメッセージ数を返す", async () => {
    await insertThread(db, "t1", WEB_RESOURCE);
    await insertThread(db, "t2", WEB_RESOURCE);
    await insertMessage(db, {
      id: "m1",
      threadId: "t1",
      createdAt: "2026-06-09T01:00:00.000Z",
    });
    await insertMessage(db, {
      id: "m2",
      threadId: "t1",
      createdAt: "2026-06-09T02:00:00.000Z",
    });
    await insertMessage(db, {
      id: "m3",
      threadId: "t2",
      createdAt: "2026-06-09T03:00:00.000Z",
    });

    const stats = await getConversationStats(d1, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-15T00:00:00.000Z",
    });

    expect(stats.totals).toEqual({ conversations: 2, messages: 3 });
  });
});

describe("getDailyUsage", () => {
  let db: TestDb;

  const insertUsage = async (params: {
    id: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    createdAt: string;
  }) => {
    await db.insert(llmUsage).values({
      id: params.id,
      model: params.model ?? "gemini-2.5-flash",
      inputTokens: params.inputTokens ?? 0,
      outputTokens: params.outputTokens ?? 0,
      totalTokens: (params.inputTokens ?? 0) + (params.outputTokens ?? 0),
      source: "chat",
      createdAt: params.createdAt,
    });
  };

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("JST の日付ごとに集計する", async () => {
    // JST 2026-06-08 00:00 ちょうど
    await insertUsage({
      id: "u1",
      inputTokens: 100,
      createdAt: "2026-06-07T15:00:00.000Z",
    });
    // JST 2026-06-08 23:59 → 同じ日
    await insertUsage({
      id: "u2",
      inputTokens: 200,
      createdAt: "2026-06-08T14:59:59.000Z",
    });
    // JST 2026-06-09 00:00 → 翌日
    await insertUsage({
      id: "u3",
      inputTokens: 400,
      createdAt: "2026-06-08T15:00:00.000Z",
    });

    const daily = await getDailyUsage(d1, {
      from: "2026-06-01T00:00:00.000Z",
    });

    expect(daily).toEqual([
      expect.objectContaining({ date: "2026-06-08", inputTokens: 300 }),
      expect.objectContaining({ date: "2026-06-09", inputTokens: 400 }),
    ]);
  });

  it("モデルごとに分けて集計し costUsd を計算する", async () => {
    await insertUsage({
      id: "u1",
      model: "gemini-2.5-flash",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      createdAt: "2026-06-09T00:00:00.000Z",
    });
    await insertUsage({
      id: "u2",
      model: "gemini-2.5-flash-lite",
      inputTokens: 1_000_000,
      outputTokens: 0,
      createdAt: "2026-06-09T01:00:00.000Z",
    });

    const daily = await getDailyUsage(d1, {
      from: "2026-06-01T00:00:00.000Z",
    });

    expect(daily).toHaveLength(2);
    const flash = daily.find((d) => d.model === "gemini-2.5-flash");
    const lite = daily.find((d) => d.model === "gemini-2.5-flash-lite");
    expect(flash?.costUsd).toBeCloseTo(2.8, 10);
    expect(lite?.costUsd).toBeCloseTo(0.1, 10);
  });
});

describe("getDailyUsage（costUsd 永続化との併用）", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("cost_usd 永続済み行はその値、NULL 行は現行単価の概算を合算する", async () => {
    await db.insert(llmUsage).values([
      {
        id: "u1",
        model: "openai/gpt-5.6-luna",
        inputTokens: 1_000_000,
        outputTokens: 0,
        totalTokens: 1_000_000,
        source: "chat",
        costUsd: 0.5,
        createdAt: "2026-06-09T00:00:00.000Z",
      },
      {
        id: "u2",
        model: "openai/gpt-5.6-luna",
        inputTokens: 1_000_000,
        outputTokens: 0,
        totalTokens: 1_000_000,
        source: "chat",
        costUsd: null,
        createdAt: "2026-06-09T01:00:00.000Z",
      },
    ]);

    const daily = await getDailyUsage(d1, {
      from: "2026-06-01T00:00:00.000Z",
    });

    // 永続 0.5 + NULL 行の概算（1M input × $0.20/1M = 0.2）
    expect(daily[0]?.costUsd).toBeCloseTo(0.7, 10);
  });
});

describe("getThreadUsage", () => {
  let db: TestDb;

  const insertUsage = async (params: {
    id: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    source?: string;
    agent?: string | null;
    threadId?: string | null;
    platform?: string | null;
    costUsd?: number | null;
    createdAt?: string;
  }) => {
    await db.insert(llmUsage).values({
      id: params.id,
      model: params.model ?? "openai/gpt-5.6-luna",
      inputTokens: params.inputTokens ?? 0,
      outputTokens: params.outputTokens ?? 0,
      cachedInputTokens: params.cachedInputTokens ?? 0,
      totalTokens: (params.inputTokens ?? 0) + (params.outputTokens ?? 0),
      source: params.source ?? "chat",
      agent: params.agent,
      threadId: params.threadId,
      platform: params.platform,
      costUsd: params.costUsd,
      createdAt: params.createdAt ?? "2026-06-09T00:00:00.000Z",
    });
  };

  const period = {
    from: "2026-06-01T00:00:00.000Z",
    to: "2026-06-15T00:00:00.000Z",
  };

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("スレッドごとに合算し、chat 行数をメッセージ数として数える", async () => {
    await insertThread(db, "t1", WEB_RESOURCE);
    await insertUsage({
      id: "u1",
      threadId: "t1",
      platform: "web",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
    });
    await insertUsage({
      id: "u2",
      threadId: "t1",
      platform: "web",
      inputTokens: 200,
      outputTokens: 100,
      costUsd: 0.02,
    });
    await insertUsage({
      id: "u3",
      threadId: "t1",
      source: "intent-classify",
      inputTokens: 10,
      costUsd: 0.001,
    });

    const result = await getThreadUsage(d1, period, { limit: 50 });

    expect(result.threads).toHaveLength(1);
    expect(result.threads[0]).toMatchObject({
      threadId: "t1",
      platform: "web",
      messageCount: 2,
      inputTokens: 310,
      outputTokens: 150,
    });
    expect(result.threads[0]?.costUsd).toBeCloseTo(0.031, 10);
    expect(result.threads[0]?.models).toEqual(["openai/gpt-5.6-luna"]);
  });

  it("会話ごと・全体のエージェント別内訳をコスト降順で返す", async () => {
    await insertUsage({
      id: "u1",
      threadId: "t1",
      agent: "nepp-chan",
      costUsd: 0.01,
    });
    await insertUsage({
      id: "u2",
      threadId: "t1",
      agent: "knowledge",
      source: "subagent",
      costUsd: 0.05,
    });
    await insertUsage({
      id: "u3",
      threadId: "t1",
      agent: "knowledge",
      source: "subagent",
      model: "gemini-flash-lite-latest",
      costUsd: 0.02,
    });

    const result = await getThreadUsage(d1, period, { limit: 50 });

    expect(result.threads[0]?.agents).toEqual([
      expect.objectContaining({ agent: "knowledge", costUsd: 0.07 }),
      expect.objectContaining({ agent: "nepp-chan", costUsd: 0.01 }),
    ]);
    expect(result.summary.byAgent).toEqual([
      expect.objectContaining({ agent: "knowledge", costUsd: 0.07 }),
      expect.objectContaining({ agent: "nepp-chan", costUsd: 0.01 }),
    ]);
  });

  it("検索クエリの埋め込みは会話原価に含め、定期処理は含めない", async () => {
    await insertUsage({ id: "u1", threadId: "t1", costUsd: 0.01 });
    await insertUsage({
      id: "u2",
      threadId: "t1",
      agent: "embedding",
      source: "embedding",
      model: "gemini-embedding-001",
      costUsd: 0.02,
    });
    await insertUsage({
      id: "u3",
      threadId: null,
      source: "weekly-report",
      costUsd: 0.03,
    });

    const result = await getThreadUsage(d1, period, { limit: 50 });

    expect(result.summary.conversationCostUsd).toBeCloseTo(0.03, 10);
    expect(result.summary.byAgent.map((a) => a.agent)).toEqual([
      "embedding",
      null,
    ]);
  });

  it("agent 列追加前の行（agent NULL）も 1 グループとして集計する", async () => {
    await insertUsage({ id: "u1", threadId: "t1", agent: null, costUsd: 0.01 });

    const result = await getThreadUsage(d1, period, { limit: 50 });

    expect(result.threads[0]?.agents).toEqual([
      expect.objectContaining({ agent: null, costUsd: 0.01 }),
    ]);
  });

  it("cost_usd NULL の行は現行単価の概算で補完する", async () => {
    await insertUsage({
      id: "u1",
      threadId: "t1",
      inputTokens: 1_000_000,
      costUsd: 0.5,
    });
    await insertUsage({
      id: "u2",
      threadId: "t1",
      inputTokens: 1_000_000,
      costUsd: null,
    });

    const result = await getThreadUsage(d1, period, { limit: 50 });

    expect(result.threads[0]?.costUsd).toBeCloseTo(0.7, 10);
  });

  it("mastra_messages から会話の開始・終了・所要秒数を出す", async () => {
    await insertThread(db, "t1", WEB_RESOURCE);
    await insertMessage(db, {
      id: "m1",
      threadId: "t1",
      createdAt: "2026-06-09T00:00:00.000Z",
    });
    await insertMessage(db, {
      id: "m2",
      threadId: "t1",
      role: "assistant",
      createdAt: "2026-06-09T00:10:00.000Z",
    });
    await insertUsage({ id: "u1", threadId: "t1", costUsd: 0.01 });

    const result = await getThreadUsage(d1, period, { limit: 50 });

    expect(result.threads[0]).toMatchObject({
      firstMessageAt: "2026-06-09T00:00:00.000Z",
      lastMessageAt: "2026-06-09T00:10:00.000Z",
      durationSeconds: 600,
    });
  });

  it("会話時間は集計期間内のメッセージだけで計算する", async () => {
    await insertThread(db, "t1", "line:abc");
    // 期間外（過去）のメッセージは LINE の生涯スレッドを想定
    await insertMessage(db, {
      id: "m0",
      threadId: "t1",
      createdAt: "2026-05-01T00:00:00.000Z",
    });
    await insertMessage(db, {
      id: "m1",
      threadId: "t1",
      createdAt: "2026-06-09T00:00:00.000Z",
    });
    await insertMessage(db, {
      id: "m2",
      threadId: "t1",
      role: "assistant",
      createdAt: "2026-06-09T00:05:00.000Z",
    });
    await insertUsage({ id: "u1", threadId: "t1", costUsd: 0.01 });

    const result = await getThreadUsage(d1, period, { limit: 50 });

    expect(result.threads[0]).toMatchObject({
      firstMessageAt: "2026-06-09T00:00:00.000Z",
      durationSeconds: 300,
    });
  });

  it("メッセージが保持期間切れで無いスレッドは時刻・所要秒数が null になる", async () => {
    await insertUsage({ id: "u1", threadId: "t1", costUsd: 0.01 });

    const result = await getThreadUsage(d1, period, { limit: 50 });

    expect(result.threads[0]).toMatchObject({
      firstMessageAt: null,
      lastMessageAt: null,
      durationSeconds: null,
    });
  });

  it("summary は会話原価と 1 メッセージ・1 会話あたりの平均を返す", async () => {
    await insertUsage({ id: "u1", threadId: "t1", costUsd: 0.03 });
    await insertUsage({ id: "u2", threadId: "t1", costUsd: 0.01 });
    await insertUsage({ id: "u3", threadId: "t2", costUsd: 0.02 });

    const result = await getThreadUsage(d1, period, { limit: 50 });

    expect(result.summary.threads).toBe(2);
    expect(result.summary.messages).toBe(3);
    expect(result.summary.conversationCostUsd).toBeCloseTo(0.06, 10);
    expect(result.summary.avgCostPerMessageUsd).toBeCloseTo(0.02, 10);
    expect(result.summary.avgCostPerThreadUsd).toBeCloseTo(0.03, 10);
  });

  it("記録が無ければ平均は null を返す", async () => {
    const result = await getThreadUsage(d1, period, { limit: 50 });

    expect(result.summary).toMatchObject({
      threads: 0,
      messages: 0,
      avgCostPerMessageUsd: null,
      avgCostPerThreadUsd: null,
    });
    expect(result.threads).toEqual([]);
  });

  it("limit はコスト降順で適用し、summary は全件で計算する", async () => {
    await insertUsage({ id: "u1", threadId: "t1", costUsd: 0.01 });
    await insertUsage({ id: "u2", threadId: "t2", costUsd: 0.05 });

    const result = await getThreadUsage(d1, period, { limit: 1 });

    expect(result.threads).toHaveLength(1);
    expect(result.threads[0]?.threadId).toBe("t2");
    expect(result.summary.threads).toBe(2);
  });

  it("期間外の行は集計しない", async () => {
    await insertUsage({
      id: "u1",
      threadId: "t1",
      costUsd: 0.01,
      createdAt: "2026-06-20T00:00:00.000Z",
    });

    const result = await getThreadUsage(d1, period, { limit: 50 });

    expect(result.threads).toEqual([]);
    expect(result.summary.conversationCostUsd).toBe(0);
  });
});

describe("getOperationCost", () => {
  let db: TestDb;

  const period = {
    from: "2026-06-01T00:00:00.000Z",
    to: "2026-06-15T00:00:00.000Z",
  };

  const insertUsage = async (params: {
    id: string;
    source: string;
    agent?: string;
    model?: string;
    totalTokens?: number;
    costUsd?: number;
    threadId?: string | null;
    createdAt?: string;
  }) => {
    await db.insert(llmUsage).values({
      id: params.id,
      model: params.model ?? "openai/gpt-5.6-luna",
      totalTokens: params.totalTokens ?? 0,
      source: params.source,
      agent: params.agent,
      threadId: params.threadId,
      costUsd: params.costUsd,
      createdAt: params.createdAt ?? "2026-06-09T00:00:00.000Z",
    });
  };

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("会話・ナレッジ基盤・バッチの 3 区分に分けて集計する", async () => {
    await insertUsage({
      id: "u1",
      source: "chat",
      agent: "nepp-chan",
      threadId: "t1",
      costUsd: 0.05,
    });
    await insertUsage({
      id: "u2",
      source: "rerank",
      agent: "knowledge-reranker",
      threadId: "t1",
      costUsd: 0.02,
    });
    await insertUsage({
      id: "u3",
      source: "embedding",
      agent: "embedding",
      model: "gemini-embedding-001",
      costUsd: 0.01,
    });
    await insertUsage({
      id: "u4",
      source: "weekly-report",
      agent: "weekly-report",
      costUsd: 0.03,
    });

    const result = await getOperationCost(d1, period);

    expect(result.totalCostUsd).toBeCloseTo(0.11, 10);
    expect(
      result.byCategory.map((c) => [c.category, Number(c.costUsd.toFixed(4))]),
    ).toEqual([
      ["conversation", 0.07],
      ["batch", 0.03],
      ["knowledge-base", 0.01],
    ]);
  });

  it("区分ごとにエージェント別の内訳を返す", async () => {
    await insertUsage({
      id: "u1",
      source: "chat",
      agent: "nepp-chan",
      costUsd: 0.02,
    });
    await insertUsage({
      id: "u2",
      source: "subagent",
      agent: "knowledge",
      costUsd: 0.06,
    });

    const result = await getOperationCost(d1, period);

    expect(result.byCategory[0]?.agents).toEqual([
      expect.objectContaining({ agent: "knowledge", costUsd: 0.06 }),
      expect.objectContaining({ agent: "nepp-chan", costUsd: 0.02 }),
    ]);
  });

  it("プロバイダ別（OpenAI / Google）をコスト降順で返す", async () => {
    await insertUsage({
      id: "u1",
      source: "chat",
      model: "openai/gpt-5.6-luna",
      totalTokens: 100,
      costUsd: 0.05,
    });
    await insertUsage({
      id: "u2",
      source: "embedding",
      model: "gemini-embedding-001",
      totalTokens: 200,
      costUsd: 0.01,
    });
    await insertUsage({
      id: "u3",
      source: "weekly-report",
      model: "gemini-2.5-flash",
      totalTokens: 300,
      costUsd: 0.02,
    });

    const result = await getOperationCost(d1, period);

    expect(result.byProvider).toEqual([
      { provider: "openai", totalTokens: 100, costUsd: 0.05 },
      { provider: "google", totalTokens: 500, costUsd: 0.03 },
    ]);
  });

  it("JST の日付ごとの推移を古い順に返す", async () => {
    await insertUsage({
      id: "u1",
      source: "chat",
      costUsd: 0.02,
      createdAt: "2026-06-09T15:00:00.000Z", // JST 06-10 00:00
    });
    await insertUsage({
      id: "u2",
      source: "chat",
      costUsd: 0.03,
      createdAt: "2026-06-09T14:59:00.000Z", // JST 06-09 23:59
    });
    await insertUsage({
      id: "u3",
      source: "rerank",
      costUsd: 0.01,
      createdAt: "2026-06-09T16:00:00.000Z", // JST 06-10 01:00
    });

    const result = await getOperationCost(d1, period);

    expect(result.daily).toEqual([
      { date: "2026-06-09", costUsd: 0.03 },
      { date: "2026-06-10", costUsd: expect.closeTo(0.03, 10) },
    ]);
  });

  it("期間外の行は集計しない", async () => {
    await insertUsage({
      id: "u1",
      source: "chat",
      costUsd: 0.05,
      createdAt: "2026-06-20T00:00:00.000Z",
    });

    const result = await getOperationCost(d1, period);

    expect(result.totalCostUsd).toBe(0);
    expect(result.byCategory).toEqual([]);
    expect(result.daily).toEqual([]);
  });
});

describe("getThreadTurnUsage", () => {
  let db: TestDb;

  const insertUsage = async (params: {
    id: string;
    turnIndex?: number | null;
    agent?: string | null;
    source?: string;
    model?: string;
    intent?: "casual" | "thinking";
    totalTokens?: number;
    costUsd?: number | null;
    durationMs?: number | null;
  }) => {
    await db.insert(llmUsage).values({
      id: params.id,
      model: params.model ?? "openai/gpt-5.6-luna",
      totalTokens: params.totalTokens ?? 0,
      source: params.source ?? "chat",
      agent: params.agent,
      intent: params.intent,
      turnIndex: params.turnIndex,
      durationMs: params.durationMs,
      threadId: "t1",
      costUsd: params.costUsd,
      createdAt: "2026-06-09T00:00:00.000Z",
    });
  };

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("往復ごとにコスト・エージェント内訳・所要時間を返す", async () => {
    await insertUsage({
      id: "u1",
      turnIndex: 1,
      agent: "nepp-chan",
      costUsd: 0.01,
      durationMs: 18_000,
    });
    await insertUsage({
      id: "u2",
      turnIndex: 1,
      agent: "knowledge",
      source: "subagent",
      costUsd: 0.05,
    });
    await insertUsage({
      id: "u3",
      turnIndex: 2,
      agent: "nepp-chan",
      costUsd: 0.002,
      durationMs: 3_000,
    });

    const { turns } = await getThreadTurnUsage(d1, "t1");

    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({
      turnIndex: 1,
      durationMs: 18_000,
      answeredAt: "2026-06-09T00:00:00.000Z",
    });
    expect(turns[0]?.costUsd).toBeCloseTo(0.06, 10);
    expect(turns[0]?.agents).toEqual([
      expect.objectContaining({ agent: "knowledge", costUsd: 0.05 }),
      expect.objectContaining({ agent: "nepp-chan", costUsd: 0.01 }),
    ]);
    expect(turns[1]).toMatchObject({ turnIndex: 2, durationMs: 3_000 });
  });

  it("本体の応答行から intent を取り出す", async () => {
    await insertUsage({
      id: "u1",
      turnIndex: 1,
      agent: "nepp-chan",
      intent: "thinking",
    });
    await insertUsage({
      id: "u2",
      turnIndex: 1,
      agent: "knowledge",
      source: "subagent",
    });

    const { turns } = await getThreadTurnUsage(d1, "t1");

    expect(turns[0]?.intent).toBe("thinking");
  });

  it("turn_index 記録前の行は turnIndex: null として末尾にまとめる", async () => {
    await insertUsage({ id: "u1", turnIndex: null, costUsd: 0.03 });
    await insertUsage({ id: "u2", turnIndex: 1, costUsd: 0.01 });

    const { turns } = await getThreadTurnUsage(d1, "t1");

    expect(turns.map((t) => t.turnIndex)).toEqual([1, null]);
  });

  it("記録が無ければ空配列を返す", async () => {
    const { turns } = await getThreadTurnUsage(d1, "t1");
    expect(turns).toEqual([]);
  });
});

describe("getUsageByModel", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("期間内の usage をモデル別に合算する", async () => {
    await db.insert(llmUsage).values([
      {
        id: "u1",
        model: "gemini-2.5-flash",
        inputTokens: 100,
        outputTokens: 10,
        totalTokens: 110,
        source: "chat",
        createdAt: "2026-06-09T00:00:00.000Z",
      },
      {
        id: "u2",
        model: "gemini-2.5-flash",
        inputTokens: 200,
        outputTokens: 20,
        totalTokens: 220,
        source: "chat",
        createdAt: "2026-06-10T00:00:00.000Z",
      },
      {
        id: "u3",
        model: "gemini-2.5-flash",
        inputTokens: 999,
        outputTokens: 999,
        totalTokens: 1998,
        source: "chat",
        createdAt: "2026-06-20T00:00:00.000Z", // 期間外
      },
    ]);

    const rows = await getUsageByModel(d1, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-15T00:00:00.000Z",
    });

    expect(rows).toEqual([
      expect.objectContaining({
        model: "gemini-2.5-flash",
        inputTokens: 300,
        outputTokens: 30,
        totalTokens: 330,
      }),
    ]);
  });
});

describe("getPersonaAnalytics", () => {
  let db: TestDb;

  const insertPersona = async (params: {
    id: string;
    tags?: string;
    demographicSummary?: string;
    topic?: string;
    sentiment?: string;
    createdAt?: string;
    conversationEndedAt?: string;
  }) => {
    await db.insert(persona).values({
      id: params.id,
      category: "意見",
      content: "テスト",
      tags: params.tags,
      demographicSummary: params.demographicSummary,
      topic: params.topic,
      sentiment: params.sentiment ?? "neutral",
      createdAt: params.createdAt ?? "2026-06-09T00:00:00.000Z",
      conversationEndedAt: params.conversationEndedAt,
    });
  };

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("tags の年代 × sentiment を集計する", async () => {
    await insertPersona({ id: "p1", tags: "60代,村内", sentiment: "negative" });
    await insertPersona({ id: "p2", tags: "60代", sentiment: "positive" });
    await insertPersona({
      id: "p3",
      tags: "80代以上,村内",
      sentiment: "request",
    });

    const result = await getPersonaAnalytics(d1, {});

    const age60 = result.ageSentiment.find((a) => a.age === "60代");
    const age80 = result.ageSentiment.find((a) => a.age === "80代以上");
    expect(age60).toEqual({
      age: "60代",
      positive: 1,
      negative: 1,
      request: 0,
      neutral: 0,
    });
    expect(age80).toEqual({
      age: "80代以上",
      positive: 0,
      negative: 0,
      request: 1,
      neutral: 0,
    });
  });

  it("tags に年代が無ければ demographic_summary から抽出し、どちらにも無ければ「不明」", async () => {
    await insertPersona({ id: "p1", demographicSummary: "30代,移住検討者" });
    await insertPersona({ id: "p2", tags: "観光客" });

    const result = await getPersonaAnalytics(d1, {});

    expect(result.ageSentiment.find((a) => a.age === "30代")?.neutral).toBe(1);
    expect(result.ageSentiment.find((a) => a.age === "不明")?.neutral).toBe(1);
  });

  it("topic 9 分類 × sentiment を集計し、topic 無しは「その他」に入る", async () => {
    await insertPersona({ id: "p1", topic: "交通", sentiment: "negative" });
    await insertPersona({ id: "p2", topic: "交通", sentiment: "request" });
    await insertPersona({ id: "p3", sentiment: "positive" }); // topic なし

    const result = await getPersonaAnalytics(d1, {});

    const traffic = result.topics.find((t) => t.topic === "交通");
    const other = result.topics.find((t) => t.topic === "その他");
    expect(traffic).toEqual({
      topic: "交通",
      total: 2,
      positive: 0,
      negative: 1,
      request: 1,
      neutral: 0,
    });
    expect(other?.total).toBe(1);
    expect(result.topics).toHaveLength(9);
  });

  it("居住地（村内/村外）と関係性（村人/観光客/移住検討者/帰省者）を集計する", async () => {
    await insertPersona({ id: "p1", tags: "60代,村内" });
    await insertPersona({ id: "p2", tags: "村外,観光客" });
    await insertPersona({ id: "p3", demographicSummary: "30代,移住検討者" });
    await insertPersona({ id: "p4", tags: "50代" }); // 居住地・関係性なし

    const result = await getPersonaAnalytics(d1, {});

    expect(result.segments.residence).toEqual(
      expect.arrayContaining([
        { label: "村内", count: 1 },
        { label: "村外", count: 1 },
        { label: "不明", count: 2 },
      ]),
    );
    expect(result.segments.relationship).toEqual(
      expect.arrayContaining([
        { label: "観光客", count: 1 },
        { label: "移住検討者", count: 1 },
        { label: "不明", count: 2 },
      ]),
    );
  });

  it("from/to は会話終了時刻基準で絞り込み、会話時刻不明の行は除外する", async () => {
    await insertPersona({
      id: "p1",
      conversationEndedAt: "2026-06-01T00:00:00.000Z",
    });
    await insertPersona({
      id: "p2",
      conversationEndedAt: "2026-06-09T00:00:00.000Z",
    });
    await insertPersona({ id: "p3" }); // conversation_ended_at なし

    const result = await getPersonaAnalytics(d1, {
      from: "2026-06-08T00:00:00.000Z",
      to: "2026-06-15T00:00:00.000Z",
    });

    expect(result.totalCount).toBe(1);
  });

  it("from/to なしは conversation_ended_at が NULL の行も含む全件を集計する", async () => {
    await insertPersona({
      id: "p1",
      conversationEndedAt: "2026-06-09T00:00:00.000Z",
    });
    await insertPersona({ id: "p2" }); // conversation_ended_at なし

    const result = await getPersonaAnalytics(d1, {});

    expect(result.totalCount).toBe(2);
  });

  it("conversation_ended_at を JST の時間帯分布に集計し、NULL は除外する", async () => {
    // UTC 00:30 → JST 9時台、UTC 23:10 → JST 8時台
    await insertPersona({
      id: "p1",
      conversationEndedAt: "2026-06-09T00:30:00.000Z",
    });
    await insertPersona({
      id: "p2",
      conversationEndedAt: "2026-06-09T00:45:00.000Z",
    });
    await insertPersona({
      id: "p3",
      conversationEndedAt: "2026-06-08T23:10:00.000Z",
    });
    await insertPersona({ id: "p4" }); // conversation_ended_at なし

    const result = await getPersonaAnalytics(d1, {});

    expect(result.hourly).toHaveLength(24);
    expect(result.hourly.find((h) => h.hour === 9)?.count).toBe(2);
    expect(result.hourly.find((h) => h.hour === 8)?.count).toBe(1);
    expect(result.hourly.reduce((sum, h) => sum + h.count, 0)).toBe(3);
  });

  it("conversation_ended_at を JST の曜日分布に集計し、NULL は除外する", async () => {
    await insertPersona({
      id: "p1",
      conversationEndedAt: "2026-06-12T10:00:00.000Z", // JST 06-12（金）→ dow 5
    });
    await insertPersona({
      id: "p2",
      conversationEndedAt: "2026-06-12T16:00:00.000Z", // JST 06-13（土）→ dow 6
    });
    await insertPersona({ id: "p3" }); // conversation_ended_at なし

    const result = await getPersonaAnalytics(d1, {});

    expect(result.weekday).toHaveLength(7);
    expect(result.weekday[5]).toEqual({ dow: 5, count: 1 });
    expect(result.weekday[6]).toEqual({ dow: 6, count: 1 });
    expect(result.weekday.reduce((sum, d) => sum + d.count, 0)).toBe(2);
  });

  it("開庁時間（平日 8〜17 時 JST）と閉庁時間の声を数える", async () => {
    await insertPersona({
      id: "p1",
      conversationEndedAt: "2026-06-12T01:00:00.000Z", // JST 金 10:00 → 開庁
    });
    await insertPersona({
      id: "p2",
      conversationEndedAt: "2026-06-12T10:00:00.000Z", // JST 金 19:00 → 閉庁（夜間）
    });
    await insertPersona({
      id: "p3",
      conversationEndedAt: "2026-06-13T02:00:00.000Z", // JST 土 11:00 → 閉庁（土日）
    });
    await insertPersona({ id: "p4" }); // conversation_ended_at なし → 対象外

    const result = await getPersonaAnalytics(d1, {});

    expect(result.officeHours).toEqual({ open: 1, closed: 2 });
  });

  it("時間帯分布も from/to（conversation_ended_at 基準）で絞り込める", async () => {
    await insertPersona({
      id: "p1",
      conversationEndedAt: "2026-06-01T00:30:00.000Z",
    });
    await insertPersona({
      id: "p2",
      conversationEndedAt: "2026-06-09T00:30:00.000Z",
    });

    const result = await getPersonaAnalytics(d1, {
      from: "2026-06-08T00:00:00.000Z",
      to: "2026-06-15T00:00:00.000Z",
    });

    expect(result.hourly.reduce((sum, h) => sum + h.count, 0)).toBe(1);
    expect(result.hourly.find((h) => h.hour === 9)?.count).toBe(1);
  });
});

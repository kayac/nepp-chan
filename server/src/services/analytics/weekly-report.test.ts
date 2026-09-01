import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import {
  llmUsage,
  mastraMessages,
  mastraThreads,
  persona,
  weeklyReports,
} from "~/db";

const { testDbHolder, agentHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
  agentHolder: { generate: vi.fn() },
}));

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return {
    ...actual,
    createDb: () => testDbHolder.db,
  };
});

vi.mock("@mastra/core/mastra", () => ({
  Mastra: vi.fn(function () {
    return { getAgent: vi.fn(() => agentHolder) };
  }),
}));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn(async () => ({ id: "fake-storage" })),
}));

vi.mock("~/mastra/request-context", () => ({
  createRequestContext: vi.fn(() => ({ id: "fake-ctx" })),
}));

vi.mock("~/mastra/agents/weekly-report-agent", () => ({
  weeklyReportAgent: { id: "weekly-report-agent" },
  WEEKLY_REPORT_SERVICE_TIER: "flex",
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { resolveReportPeriod, runWeeklyReport } = await import(
  "./weekly-report"
);

const env = { DB: {} as D1Database } as unknown as CloudflareBindings;

describe("resolveReportPeriod", () => {
  it("火曜 05:00 JST 実行で前週の月〜日になる", () => {
    // JST 2026-06-09(火) 05:00
    const period = resolveReportPeriod(new Date("2026-06-08T20:00:00.000Z"));

    expect(period).toEqual({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-07",
      from: "2026-05-31T15:00:00.000Z",
      to: "2026-06-07T15:00:00.000Z",
    });
  });

  it("月曜 00:00 JST ちょうどの実行でも前週を対象にする", () => {
    // JST 2026-06-08(月) 00:00
    const period = resolveReportPeriod(new Date("2026-06-07T15:00:00.000Z"));

    expect(period.periodStart).toBe("2026-06-01");
    expect(period.periodEnd).toBe("2026-06-07");
  });
});

describe("runWeeklyReport", () => {
  let db: TestDb;

  // JST 2026-06-09(火) 05:00 実行 → 対象週は 06-01〜06-07
  const NOW = new Date("2026-06-08T20:00:00.000Z");

  const insertPersonaInPeriod = async () => {
    await db.insert(persona).values({
      id: crypto.randomUUID(),
      category: "困りごと",
      content: "朝のバスが1本しかなく通院の時間が合わない",
      topic: "交通",
      sentiment: "negative",
      createdAt: "2026-06-03T00:00:00.000Z",
    });
  };

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    vi.clearAllMocks();
    agentHolder.generate.mockResolvedValue({
      text: "今週は交通の困りごとが目立ちました。",
      totalUsage: { inputTokens: 100, outputTokens: 50 },
    });
  });

  it("対象週の stats と LLM 要約を weekly_reports に保存する", async () => {
    await db.insert(mastraThreads).values({
      id: "t1",
      resourceId: "line:hashed",
      createdAt: "2026-06-01T00:00:00.000Z",
    });
    await db.insert(mastraMessages).values({
      id: "m1",
      threadId: "t1",
      role: "user",
      createdAt: "2026-06-03T01:00:00.000Z",
    });
    await db.insert(llmUsage).values({
      id: "u1",
      model: "gemini-2.5-flash",
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      source: "chat",
      createdAt: "2026-06-03T01:00:00.000Z",
    });
    await insertPersonaInPeriod();

    await runWeeklyReport(env, { now: NOW });

    const rows = await db.select().from(weeklyReports).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.periodStart).toBe("2026-06-01");
    expect(rows[0]?.periodEnd).toBe("2026-06-07");
    expect(rows[0]?.summary).toBe("今週は交通の困りごとが目立ちました。");

    const stats = JSON.parse(rows[0]?.stats ?? "{}");
    expect(stats.conversationCount).toBe(1);
    expect(stats.messageCount).toBe(1);
    expect(stats.hourly).toHaveLength(24);
    expect(stats.platforms).toEqual([{ platform: "line", count: 1 }]);
    expect(stats.usageByModel).toEqual([
      expect.objectContaining({ model: "gemini-2.5-flash", totalTokens: 1500 }),
    ]);
  });

  it("対象週の persona が 0 件なら LLM を呼ばず固定文を保存する", async () => {
    await runWeeklyReport(env, { now: NOW });

    expect(agentHolder.generate).not.toHaveBeenCalled();
    const rows = await db.select().from(weeklyReports).all();
    expect(rows[0]?.summary).toBe(
      "この週に抽出された村の声はありませんでした。",
    );
  });

  it("対象週より前の persona は要約対象にしない", async () => {
    await db.insert(persona).values({
      id: crypto.randomUUID(),
      category: "意見",
      content: "古い声",
      createdAt: "2026-05-01T00:00:00.000Z",
    });

    await runWeeklyReport(env, { now: NOW });

    expect(agentHolder.generate).not.toHaveBeenCalled();
  });

  it("要約生成の usage を source=weekly-report で記録する", async () => {
    await insertPersonaInPeriod();

    await runWeeklyReport(env, { now: NOW });

    const usageRows = await db.select().from(llmUsage).all();
    expect(usageRows).toEqual([
      expect.objectContaining({
        source: "weekly-report",
        inputTokens: 100,
        outputTokens: 50,
      }),
    ]);
  });

  it("同じ週への再実行は上書きして重複しない", async () => {
    await insertPersonaInPeriod();

    await runWeeklyReport(env, { now: NOW });
    agentHolder.generate.mockResolvedValue({
      text: "再生成された要約",
      totalUsage: { inputTokens: 1, outputTokens: 1 },
    });
    await runWeeklyReport(env, { now: NOW });

    const rows = await db.select().from(weeklyReports).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.summary).toBe("再生成された要約");
  });
});

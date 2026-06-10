import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { weeklyReports } from "~/db";

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

const { weeklyReportRepository } = await import("./weekly-report-repository");

const d1 = {} as D1Database;

const sampleReport = (periodStart: string) => ({
  id: crypto.randomUUID(),
  periodStart,
  periodEnd: "2026-06-14",
  stats: JSON.stringify({ conversationCount: 1 }),
  summary: "今週のハイライト",
  createdAt: "2026-06-16T00:00:00.000Z",
});

describe("weeklyReportRepository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("upsert: 新規 period は insert される", async () => {
    await weeklyReportRepository.upsert(d1, sampleReport("2026-06-08"));

    const rows = await db.select().from(weeklyReports).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.periodStart).toBe("2026-06-08");
  });

  it("upsert: 同じ period_start への再実行は上書きして重複しない", async () => {
    await weeklyReportRepository.upsert(d1, sampleReport("2026-06-08"));
    await weeklyReportRepository.upsert(d1, {
      ...sampleReport("2026-06-08"),
      summary: "再生成されたハイライト",
    });

    const rows = await db.select().from(weeklyReports).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.summary).toBe("再生成されたハイライト");
  });

  it("list: period_start 降順で limit 件返す", async () => {
    await weeklyReportRepository.upsert(d1, sampleReport("2026-06-01"));
    await weeklyReportRepository.upsert(d1, sampleReport("2026-06-08"));
    await weeklyReportRepository.upsert(d1, sampleReport("2026-05-25"));

    const reports = await weeklyReportRepository.list(d1, { limit: 2 });

    expect(reports.map((r) => r.periodStart)).toEqual([
      "2026-06-08",
      "2026-06-01",
    ]);
  });

  it("findById: 存在しない id は undefined", async () => {
    const report = await weeklyReportRepository.findById(d1, "missing");
    expect(report).toBeUndefined();
  });

  it("findById: 保存済みレポートを取得できる", async () => {
    const input = sampleReport("2026-06-08");
    await weeklyReportRepository.upsert(d1, input);

    const report = await weeklyReportRepository.findById(d1, input.id);
    expect(report?.summary).toBe("今週のハイライト");
  });
});

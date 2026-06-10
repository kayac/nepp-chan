import * as Sentry from "@sentry/cloudflare";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/cloudflare", () => ({
  withMonitor: vi.fn(async (_slug, callback) => callback()),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("~/services/analytics/weekly-report", () => ({
  runWeeklyReport: vi.fn(),
}));

const { runWeeklyReport } = await import("~/services/analytics/weekly-report");
const { handleWeeklyReport } = await import("./weekly-report-handler");

const env = {} as CloudflareBindings;
const ctx = {} as ExecutionContext;

const buildEvent = () =>
  ({
    cron: "0 20 * * 1",
    type: "scheduled",
    scheduledTime: Date.now(),
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
  }) as any;

const sampleResult = {
  period: {
    periodStart: "2026-06-01",
    periodEnd: "2026-06-07",
    from: "2026-05-31T15:00:00.000Z",
    to: "2026-06-07T15:00:00.000Z",
  },
  stats: {
    conversationCount: 0,
    messageCount: 0,
    hourly: [],
    platforms: [],
    usageByModel: [],
  },
};

describe("handleWeeklyReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runWeeklyReport を env つきで呼ぶ", async () => {
    vi.mocked(runWeeklyReport).mockResolvedValue(sampleResult);

    await handleWeeklyReport(buildEvent(), env, ctx);

    expect(runWeeklyReport).toHaveBeenCalledWith(env);
  });

  it("失敗時は throw して Cron Trigger に再試行させる", async () => {
    vi.mocked(runWeeklyReport).mockRejectedValue(new Error("llm error"));

    await expect(handleWeeklyReport(buildEvent(), env, ctx)).rejects.toThrow(
      "llm error",
    );
  });

  it("Sentry Cron Monitor の weekly-report slug と crontab schedule で wrap される", async () => {
    vi.mocked(runWeeklyReport).mockResolvedValue(sampleResult);

    await handleWeeklyReport(buildEvent(), env, ctx);

    expect(Sentry.withMonitor).toHaveBeenCalledWith(
      "weekly-report",
      expect.any(Function),
      expect.objectContaining({
        schedule: { type: "crontab", value: "0 20 * * 1" },
        timezone: "UTC",
      }),
    );
  });
});

import * as Sentry from "@sentry/cloudflare";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scope = { setLevel: vi.fn(), setTag: vi.fn() };

vi.mock("@sentry/cloudflare", () => ({
  withMonitor: vi.fn(async (_slug, callback) => callback()),
  getCurrentScope: vi.fn(() => scope),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("~/services/data-retention", () => ({
  runDataRetention: vi.fn(),
}));

const { runDataRetention } = await import("~/services/data-retention");
const { handleDataRetention } = await import("./data-retention-handler");

const env = {} as CloudflareBindings;
const ctx = {} as ExecutionContext;

const buildEvent = () =>
  ({
    cron: "0 18 * * *",
    type: "scheduled",
    scheduledTime: Date.now(),
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
  }) as any;

describe("handleDataRetention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runDataRetention を env つきで呼ぶ", async () => {
    vi.mocked(runDataRetention).mockResolvedValue([]);

    await handleDataRetention(buildEvent(), env, ctx);

    expect(runDataRetention).toHaveBeenCalledWith(env);
  });

  it("削除件数とテーブル数を集計してログに残す", async () => {
    vi.mocked(runDataRetention).mockResolvedValue([
      { table: "mastra_messages", deletedCount: 3 },
      { table: "mastra_threads", deletedCount: 1 },
    ]);

    await handleDataRetention(buildEvent(), env, ctx);

    expect(Sentry.logger.info).toHaveBeenCalledWith(
      "[DataRetention] Completed: 4 total rows deleted across 2 tables",
      undefined,
    );
  });

  it("失敗時は throw して Cron Trigger に再試行させる", async () => {
    vi.mocked(runDataRetention).mockRejectedValue(new Error("db"));

    await expect(handleDataRetention(buildEvent(), env, ctx)).rejects.toThrow(
      "db",
    );
  });

  it("Sentry Cron Monitor の data-retention slug と crontab schedule で wrap される", async () => {
    vi.mocked(runDataRetention).mockResolvedValue([]);

    await handleDataRetention(buildEvent(), env, ctx);

    expect(Sentry.withMonitor).toHaveBeenCalledWith(
      "data-retention",
      expect.any(Function),
      expect.objectContaining({
        schedule: { type: "crontab", value: "0 18 * * *" },
        timezone: "UTC",
      }),
    );
  });

  it("失敗時は scope に privacy_critical タグを付けてから throw する", async () => {
    vi.mocked(runDataRetention).mockRejectedValue(new Error("db"));

    await expect(handleDataRetention(buildEvent(), env, ctx)).rejects.toThrow(
      "db",
    );
    expect(scope.setLevel).toHaveBeenCalledWith("fatal");
    expect(scope.setTag).toHaveBeenCalledWith("privacy_critical", "true");
    expect(scope.setTag).toHaveBeenCalledWith(
      "component",
      "data-retention-handler",
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("正常系: runDataRetention を env つきで呼ぶ", async () => {
    vi.mocked(runDataRetention).mockResolvedValue([]);

    await handleDataRetention(buildEvent(), env, ctx);

    expect(runDataRetention).toHaveBeenCalledWith(env);
  });

  it("結果をログに残して完了する", async () => {
    vi.mocked(runDataRetention).mockResolvedValue([
      { table: "mastra_messages", deletedCount: 3 },
      { table: "mastra_threads", deletedCount: 1 },
    ]);

    await expect(
      handleDataRetention(buildEvent(), env, ctx),
    ).resolves.toBeUndefined();
  });

  it("失敗時は throw して Cron Trigger に再試行させる", async () => {
    vi.mocked(runDataRetention).mockRejectedValue(new Error("db"));

    await expect(handleDataRetention(buildEvent(), env, ctx)).rejects.toThrow(
      "db",
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/persona-extractor", () => ({
  extractAllPendingThreads: vi.fn(),
}));

const { extractAllPendingThreads } = await import(
  "~/services/persona-extractor"
);
const { handlePersonaExtract } = await import("./persona-extract-handler");

const env = {} as CloudflareBindings;
const ctx = {} as ExecutionContext;

const buildEvent = () =>
  ({
    cron: "0 18 * * *",
    type: "scheduled",
    scheduledTime: Date.now(),
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
  }) as any;

describe("handlePersonaExtract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: extractAllPendingThreads を呼ぶ", async () => {
    vi.mocked(extractAllPendingThreads).mockResolvedValue([]);

    await handlePersonaExtract(buildEvent(), env, ctx);

    expect(extractAllPendingThreads).toHaveBeenCalledWith(env);
  });

  it("結果（extracted / skipped）を集計する", async () => {
    vi.mocked(extractAllPendingThreads).mockResolvedValue([
      { threadId: "t1", result: { extracted: true, messageCount: 1 } },
      { threadId: "t2", result: { skipped: true, reason: "x" } },
    ]);

    await expect(
      handlePersonaExtract(buildEvent(), env, ctx),
    ).resolves.toBeUndefined();
  });

  it("失敗時は throw して Cron Trigger に再試行させる", async () => {
    vi.mocked(extractAllPendingThreads).mockRejectedValue(new Error("db"));

    await expect(handlePersonaExtract(buildEvent(), env, ctx)).rejects.toThrow(
      "db",
    );
  });
});

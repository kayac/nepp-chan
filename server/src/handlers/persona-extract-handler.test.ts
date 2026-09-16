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

  it("失敗時は throw（withSentry が拾う）", async () => {
    vi.mocked(extractAllPendingThreads).mockRejectedValue(new Error("db"));

    await expect(handlePersonaExtract(buildEvent(), env, ctx)).rejects.toThrow(
      "db",
    );
  });
});

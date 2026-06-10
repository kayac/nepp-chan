import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/handlers/broadcast-handler", () => ({
  handleBroadcastCheck: vi.fn(),
}));

vi.mock("~/handlers/poll-handler", () => ({
  handlePollCheck: vi.fn(),
}));

vi.mock("~/handlers/persona-extract-handler", () => ({
  handlePersonaExtract: vi.fn(),
}));

vi.mock("~/handlers/data-retention-handler", () => ({
  handleDataRetention: vi.fn(),
}));

vi.mock("~/handlers/weekly-report-handler", () => ({
  handleWeeklyReport: vi.fn(),
}));

const { handleBroadcastCheck } = await import("~/handlers/broadcast-handler");
const { handlePollCheck } = await import("~/handlers/poll-handler");
const { handlePersonaExtract } = await import(
  "~/handlers/persona-extract-handler"
);
const { handleDataRetention } = await import(
  "~/handlers/data-retention-handler"
);
const { handleWeeklyReport } = await import("~/handlers/weekly-report-handler");
const { handleScheduled } = await import("./scheduled-handler");

const env = {} as CloudflareBindings;
const ctx = {} as ExecutionContext;

const buildEvent = (cron: string) =>
  ({
    cron,
    type: "scheduled",
    scheduledTime: Date.now(),
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
  }) as any;

describe("handleScheduled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("'*/5 * * * *' は broadcast + poll を呼ぶ", async () => {
    await handleScheduled(buildEvent("*/5 * * * *"), env, ctx);

    expect(handleBroadcastCheck).toHaveBeenCalled();
    expect(handlePollCheck).toHaveBeenCalled();
    expect(handlePersonaExtract).not.toHaveBeenCalled();
    expect(handleDataRetention).not.toHaveBeenCalled();
  });

  it("'0 18 * * *' は persona extract → data retention の順で呼ぶ", async () => {
    const callOrder: string[] = [];
    vi.mocked(handlePersonaExtract).mockImplementation(async () => {
      callOrder.push("persona");
    });
    vi.mocked(handleDataRetention).mockImplementation(async () => {
      callOrder.push("retention");
    });

    await handleScheduled(buildEvent("0 18 * * *"), env, ctx);

    expect(callOrder).toEqual(["persona", "retention"]);
    expect(handleBroadcastCheck).not.toHaveBeenCalled();
    expect(handlePollCheck).not.toHaveBeenCalled();
  });

  it("'0 18 * * *' で persona extract が throw すると data retention は呼ばれない", async () => {
    vi.mocked(handlePersonaExtract).mockRejectedValue(new Error("boom"));

    await expect(
      handleScheduled(buildEvent("0 18 * * *"), env, ctx),
    ).rejects.toThrow("boom");
    expect(handleDataRetention).not.toHaveBeenCalled();
  });

  it("'0 20 * * 1' は weekly report のみ呼ぶ", async () => {
    await handleScheduled(buildEvent("0 20 * * 1"), env, ctx);

    expect(handleWeeklyReport).toHaveBeenCalled();
    expect(handleBroadcastCheck).not.toHaveBeenCalled();
    expect(handlePersonaExtract).not.toHaveBeenCalled();
    expect(handleDataRetention).not.toHaveBeenCalled();
  });

  it("未知の cron 表現は何も呼ばない", async () => {
    await handleScheduled(buildEvent("0 0 * * *"), env, ctx);

    expect(handleBroadcastCheck).not.toHaveBeenCalled();
    expect(handlePollCheck).not.toHaveBeenCalled();
    expect(handlePersonaExtract).not.toHaveBeenCalled();
    expect(handleDataRetention).not.toHaveBeenCalled();
    expect(handleWeeklyReport).not.toHaveBeenCalled();
  });
});

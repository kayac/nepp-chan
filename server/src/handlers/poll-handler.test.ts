import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/poll-repository", () => ({
  pollRepository: { findScheduledReady: vi.fn() },
}));

vi.mock("~/services/poll-delivery", () => ({
  sendPoll: vi.fn(),
}));

const { pollRepository } = await import("~/repository/poll-repository");
const { sendPoll } = await import("~/services/poll-delivery");
const { handlePollCheck } = await import("./poll-handler");

const env = { DB: {} as D1Database } as unknown as CloudflareBindings;
const ctx = {} as ExecutionContext;

const buildEvent = () =>
  ({
    cron: "*/5 * * * *",
    type: "scheduled",
    scheduledTime: Date.now(),
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
  }) as any;

const sample = (id: string) => ({
  id,
  title: id,
  choices: JSON.stringify(["a", "b"]),
  followUpPrompt: null,
  status: "scheduled" as const,
  createdBy: "u",
  createdAt: "x",
  updatedAt: null,
  scheduledAt: "x",
  sentAt: null,
  closedAt: null,
});

describe("handlePollCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ready が空ならなにもしない", async () => {
    vi.mocked(pollRepository.findScheduledReady).mockResolvedValue([]);

    await handlePollCheck(buildEvent(), env, ctx);

    expect(sendPoll).not.toHaveBeenCalled();
  });

  it("並列で sendPoll を呼ぶ", async () => {
    vi.mocked(pollRepository.findScheduledReady).mockResolvedValue([
      sample("p-1"),
      sample("p-2"),
    ]);
    vi.mocked(sendPoll).mockResolvedValue({ success: true });

    await handlePollCheck(buildEvent(), env, ctx);

    expect(sendPoll).toHaveBeenCalledTimes(2);
  });

  it("一部 reject されても全体は完了する（Promise.allSettled 利用）", async () => {
    vi.mocked(pollRepository.findScheduledReady).mockResolvedValue([
      sample("p-1"),
      sample("p-2"),
    ]);
    vi.mocked(sendPoll)
      .mockRejectedValueOnce(new Error("net"))
      .mockResolvedValueOnce({ success: true });

    await expect(
      handlePollCheck(buildEvent(), env, ctx),
    ).resolves.toBeUndefined();
    expect(sendPoll).toHaveBeenCalledTimes(2);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/broadcast-repository", () => ({
  broadcastRepository: { findScheduledReady: vi.fn() },
}));

vi.mock("~/services/broadcast-service", () => ({
  sendBroadcast: vi.fn(),
}));

const { broadcastRepository } = await import(
  "~/repository/broadcast-repository"
);
const { sendBroadcast } = await import("~/services/broadcast-service");
const { handleBroadcastCheck } = await import("./broadcast-handler");

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
  title: `t-${id}`,
  body: "b",
  parts: null,
  status: "scheduled",
  scheduledAt: "2025-01-01T00:00:00Z",
  sentAt: null,
  errorMessage: null,
  createdBy: "u",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
});

describe("handleBroadcastCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ready が空ならなにもしない", async () => {
    vi.mocked(broadcastRepository.findScheduledReady).mockResolvedValue([]);

    await handleBroadcastCheck(buildEvent(), env, ctx);

    expect(sendBroadcast).not.toHaveBeenCalled();
  });

  it("ready 全件に sendBroadcast を順次呼ぶ", async () => {
    vi.mocked(broadcastRepository.findScheduledReady).mockResolvedValue([
      sample("b-1"),
      sample("b-2"),
    ]);
    vi.mocked(sendBroadcast).mockResolvedValue({ success: true });

    await handleBroadcastCheck(buildEvent(), env, ctx);

    expect(sendBroadcast).toHaveBeenCalledTimes(2);
    expect(sendBroadcast).toHaveBeenCalledWith(env, "b-1");
    expect(sendBroadcast).toHaveBeenCalledWith(env, "b-2");
  });

  it("失敗が混じってもループは続く", async () => {
    vi.mocked(broadcastRepository.findScheduledReady).mockResolvedValue([
      sample("b-1"),
      sample("b-2"),
    ]);
    vi.mocked(sendBroadcast)
      .mockResolvedValueOnce({ success: false, error: "e" })
      .mockResolvedValueOnce({ success: true });

    await handleBroadcastCheck(buildEvent(), env, ctx);

    expect(sendBroadcast).toHaveBeenCalledTimes(2);
  });
});

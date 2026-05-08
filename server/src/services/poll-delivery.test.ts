import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/poll-repository", () => ({
  pollRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

const { mockBroadcastFn } = vi.hoisted(() => ({
  mockBroadcastFn: vi.fn(),
}));

vi.mock("~/services/line-messaging", () => ({
  createLineClient: () => ({ broadcast: mockBroadcastFn }),
}));

const { pollRepository } = await import("~/repository/poll-repository");
const { sendPoll, buildPollFlexMessage, encodePollPostback } = await import(
  "./poll-delivery"
);

const env = {
  DB: {} as D1Database,
  LINE_CHANNEL_ACCESS_TOKEN: "token",
} as unknown as CloudflareBindings;

const dbRow = {
  id: "p-1",
  title: "好きな季節",
  choices: JSON.stringify(["春", "夏", "秋", "冬"]),
  followUpPrompt: null,
  status: "draft" as const,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
  scheduledAt: null,
  sentAt: null,
  closedAt: null,
};

describe("encodePollPostback", () => {
  it("URI エンコードされた data を返す", () => {
    expect(encodePollPostback("p-1", "春 / 桜")).toBe(
      "poll=p-1&c=%E6%98%A5%20%2F%20%E6%A1%9C",
    );
  });
});

describe("buildPollFlexMessage", () => {
  it("選択肢ごとに postback ボタンを生成する", () => {
    const msg = buildPollFlexMessage(dbRow);

    expect(msg.type).toBe("flex");
    const footerContents = (msg.contents as { footer: { contents: unknown[] } })
      .footer.contents;
    expect(footerContents).toHaveLength(4);
  });

  it("ラベルは 20 文字でカット", () => {
    const longChoice = "あ".repeat(30);
    const msg = buildPollFlexMessage({
      ...dbRow,
      choices: JSON.stringify([longChoice]),
    });

    const button = (
      msg.contents as { footer: { contents: { action: { label: string } }[] } }
    ).footer.contents[0];
    expect(button.action.label).toHaveLength(20);
  });
});

describe("sendPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("存在しない id は失敗", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(null);

    const result = await sendPoll(env, "missing");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/見つかりません/);
  });

  it("status=sent は失敗", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue({
      ...dbRow,
      status: "sent",
    });

    const result = await sendPoll(env, "p-1");

    expect(result.success).toBe(false);
    expect(mockBroadcastFn).not.toHaveBeenCalled();
  });

  it("status=closed は失敗", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue({
      ...dbRow,
      status: "closed",
    });

    const result = await sendPoll(env, "p-1");

    expect(result.success).toBe(false);
    expect(mockBroadcastFn).not.toHaveBeenCalled();
  });

  it("成功時に sent ステータス + sentAt を更新", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    mockBroadcastFn.mockResolvedValue(undefined);

    const result = await sendPoll(env, "p-1");

    expect(result.success).toBe(true);
    const arg = vi.mocked(pollRepository.update).mock.calls[0]?.[2];
    expect(arg).toMatchObject({ status: "sent" });
    expect(typeof arg?.sentAt).toBe("string");
  });

  it("LINE API 失敗時は status を更新せず error を返す", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    mockBroadcastFn.mockRejectedValue(new Error("network"));

    const result = await sendPoll(env, "p-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("network");
    expect(pollRepository.update).not.toHaveBeenCalled();
  });
});

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

const WEB_URL = "https://web.example.com";

// body.contents = [見出し, 質問文, 区切り線, 選択肢ボタンの box] の順
type ChoiceButton = {
  style: string;
  color: string;
  action: { label: string };
};
type PollBody = {
  body: {
    contents: [unknown, unknown, unknown, { contents: ChoiceButton[] }];
  };
  hero: { url: string };
};

const getButtons = (msg: ReturnType<typeof buildPollFlexMessage>) =>
  (msg.contents as unknown as PollBody).body.contents[3].contents;

describe("buildPollFlexMessage", () => {
  it("選択肢ごとに postback ボタンを body 内に生成する", () => {
    const msg = buildPollFlexMessage(dbRow, WEB_URL);

    expect(msg.type).toBe("flex");
    expect(getButtons(msg)).toHaveLength(4);
  });

  it("1 つ目はプライマリ teal、2 つ目以降はセカンダリ", () => {
    const msg = buildPollFlexMessage(dbRow, WEB_URL);
    const buttons = getButtons(msg);

    expect(buttons[0]).toMatchObject({ style: "primary", color: "#5cb7bb" });
    expect(buttons[1]).toMatchObject({ style: "secondary", color: "#f3eee6" });
    expect(buttons[3]).toMatchObject({ style: "secondary" });
  });

  it("hero 画像 URL は WEB_URL を基点に組み立てる", () => {
    const msg = buildPollFlexMessage(dbRow, WEB_URL);

    const hero = (msg.contents as unknown as PollBody).hero;
    expect(hero.url).toBe(
      `${WEB_URL}/line-assets/hero-mountain-generated-20x2-full-nearest.png`,
    );
  });

  it("ラベルは 20 文字でカット", () => {
    const longChoice = "あ".repeat(30);
    const msg = buildPollFlexMessage(
      { ...dbRow, choices: JSON.stringify([longChoice]) },
      WEB_URL,
    );

    expect(getButtons(msg)[0].action.label).toHaveLength(20);
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

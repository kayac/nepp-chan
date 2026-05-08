import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/broadcast-repository", () => ({
  broadcastRepository: {
    create: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    markSent: vi.fn(),
    markFailed: vi.fn(),
  },
}));

const { mockBroadcastFn } = vi.hoisted(() => ({
  mockBroadcastFn: vi.fn(),
}));

vi.mock("~/services/line-messaging", () => ({
  createLineClient: () => ({ broadcast: mockBroadcastFn }),
}));

const { broadcastRepository } = await import(
  "~/repository/broadcast-repository"
);
const { createBroadcastMessage, updateBroadcastMessage, sendBroadcast } =
  await import("./broadcast-service");

const env = {
  DB: {} as D1Database,
  LINE_CHANNEL_ACCESS_TOKEN: "token",
  WEB_URL: "https://web.example.com",
  ENVIRONMENT: "production",
} as unknown as CloudflareBindings;

const baseBroadcast = {
  id: "b-1",
  title: "本文の先頭…",
  body: "本文",
  parts: JSON.stringify([{ type: "text", text: "本文" }]),
  status: "draft",
  scheduledAt: null,
  sentAt: null,
  errorMessage: null,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

describe("createBroadcastMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("status は scheduledAt が無ければ draft", async () => {
    vi.mocked(broadcastRepository.create).mockResolvedValue("b-1");
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);

    await createBroadcastMessage(env, {
      parts: [{ type: "text", text: "本文" }],
      createdBy: "u-1",
    });

    expect(broadcastRepository.create).toHaveBeenCalledWith(
      env.DB,
      expect.objectContaining({ status: "draft" }),
    );
  });

  it("scheduledAt があれば status=scheduled", async () => {
    vi.mocked(broadcastRepository.create).mockResolvedValue("b-1");
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);

    await createBroadcastMessage(env, {
      parts: [{ type: "text", text: "本文" }],
      scheduledAt: "2025-12-01T00:00:00Z",
      createdBy: "u-1",
    });

    expect(broadcastRepository.create).toHaveBeenCalledWith(
      env.DB,
      expect.objectContaining({
        status: "scheduled",
        scheduledAt: "2025-12-01T00:00:00Z",
      }),
    );
  });

  it("title は body の先頭 50 文字 + 51 文字以降は … 付き", async () => {
    vi.mocked(broadcastRepository.create).mockResolvedValue("b-1");
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);

    const longText = "あ".repeat(60);
    await createBroadcastMessage(env, {
      parts: [{ type: "text", text: longText }],
      createdBy: "u-1",
    });

    const arg = vi.mocked(broadcastRepository.create).mock.calls[0]?.[1];
    expect(arg?.title).toBe(`${"あ".repeat(50)}…`);
  });

  it("境界値: 50 文字ぴったりは … 付かない", async () => {
    vi.mocked(broadcastRepository.create).mockResolvedValue("b-1");
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);

    const exactly50 = "あ".repeat(50);
    await createBroadcastMessage(env, {
      parts: [{ type: "text", text: exactly50 }],
      createdBy: "u-1",
    });

    const arg = vi.mocked(broadcastRepository.create).mock.calls[0]?.[1];
    expect(arg?.title).toBe(exactly50);
  });

  it("最初の text part を body にする（image だけだと body は空）", async () => {
    vi.mocked(broadcastRepository.create).mockResolvedValue("b-1");
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);

    await createBroadcastMessage(env, {
      parts: [
        { type: "image", imageR2Key: "k.jpg" },
        { type: "text", text: "テキスト" },
      ],
      createdBy: "u-1",
    });

    const arg = vi.mocked(broadcastRepository.create).mock.calls[0]?.[1];
    expect(arg?.body).toBe("テキスト");
  });

  it("sendNow=true なら sendBroadcast を呼んで成功時はそのまま返す", async () => {
    vi.mocked(broadcastRepository.create).mockResolvedValue("b-1");
    // sendBroadcast 内の findById は draft、最終取得は sent
    vi.mocked(broadcastRepository.findById)
      .mockResolvedValueOnce(baseBroadcast)
      .mockResolvedValueOnce({ ...baseBroadcast, status: "sent" });
    mockBroadcastFn.mockResolvedValue(undefined);

    const result = await createBroadcastMessage(env, {
      parts: [{ type: "text", text: "本文" }],
      sendNow: true,
      createdBy: "u-1",
    });

    expect(mockBroadcastFn).toHaveBeenCalled();
    expect(result.status).toBe("sent");
  });

  it("sendNow=true で送信失敗なら throw", async () => {
    vi.mocked(broadcastRepository.create).mockResolvedValue("b-1");
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);
    mockBroadcastFn.mockRejectedValue(new Error("LINE 5xx"));

    await expect(
      createBroadcastMessage(env, {
        parts: [{ type: "text", text: "本文" }],
        sendNow: true,
        createdBy: "u-1",
      }),
    ).rejects.toThrow(/LINE 5xx/);
  });
});

describe("updateBroadcastMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parts 更新で title / body / parts JSON が更新される", async () => {
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);

    await updateBroadcastMessage(env.DB, "b-1", {
      parts: [{ type: "text", text: "更新後本文" }],
    });

    const arg = vi.mocked(broadcastRepository.update).mock.calls[0]?.[2];
    expect(arg).toMatchObject({
      title: "更新後本文",
      body: "更新後本文",
    });
    expect(arg?.parts).toBe(
      JSON.stringify([{ type: "text", text: "更新後本文" }]),
    );
  });

  it("scheduledAt を null にしたら status=draft", async () => {
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);

    await updateBroadcastMessage(env.DB, "b-1", { scheduledAt: null });

    const arg = vi.mocked(broadcastRepository.update).mock.calls[0]?.[2];
    expect(arg).toMatchObject({ status: "draft", scheduledAt: null });
  });

  it("scheduledAt を設定したら status=scheduled", async () => {
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);

    await updateBroadcastMessage(env.DB, "b-1", {
      scheduledAt: "2025-12-01T00:00:00Z",
    });

    const arg = vi.mocked(broadcastRepository.update).mock.calls[0]?.[2];
    expect(arg).toMatchObject({ status: "scheduled" });
  });
});

describe("sendBroadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("存在しない broadcast は失敗", async () => {
    vi.mocked(broadcastRepository.findById).mockResolvedValue(null);

    const result = await sendBroadcast(env, "missing");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/見つかりません/);
  });

  it("既送信は失敗", async () => {
    vi.mocked(broadcastRepository.findById).mockResolvedValue({
      ...baseBroadcast,
      status: "sent",
    });

    const result = await sendBroadcast(env, "b-1");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/既に送信/);
    expect(mockBroadcastFn).not.toHaveBeenCalled();
  });

  it("成功時に markSent を呼ぶ", async () => {
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);
    mockBroadcastFn.mockResolvedValue(undefined);

    const result = await sendBroadcast(env, "b-1");

    expect(result.success).toBe(true);
    expect(broadcastRepository.markSent).toHaveBeenCalledWith(env.DB, "b-1");
  });

  it("LINE API 失敗時は markFailed + error を返す", async () => {
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);
    mockBroadcastFn.mockRejectedValue(new Error("network"));

    const result = await sendBroadcast(env, "b-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("network");
    expect(broadcastRepository.markFailed).toHaveBeenCalledWith(
      env.DB,
      "b-1",
      "network",
    );
  });

  it("解説ボタンが broadcastId 付きで messages の末尾に追加される", async () => {
    vi.mocked(broadcastRepository.findById).mockResolvedValue(baseBroadcast);
    mockBroadcastFn.mockResolvedValue(undefined);

    await sendBroadcast(env, "b-1");

    const callArg = mockBroadcastFn.mock.calls[0]?.[0];
    const messages = callArg?.messages as { type: string }[];
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[messages.length - 1].type).toBe("flex");
  });
});

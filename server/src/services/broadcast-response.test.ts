import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/broadcast-repository", () => ({
  broadcastRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("~/lib/principal", () => ({
  toLineIds: vi.fn(),
}));

vi.mock("~/services/line-messaging", () => ({
  createLineClient: vi.fn(() => ({ id: "fake-client" })),
  generateReply: vi.fn(),
  sendLineMessages: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { broadcastRepository } = await import(
  "~/repository/broadcast-repository"
);
const { toLineIds } = await import("~/lib/principal");
const { createLineClient, generateReply, sendLineMessages } = await import(
  "~/services/line-messaging"
);
const { logger } = await import("~/lib/logger");
const { handleBroadcastPostback, generateBroadcastExplanation } = await import(
  "./broadcast-response"
);

const env = {
  DB: {} as D1Database,
  RESOURCE_ID_HASH_SECRET: "secret",
  LINE_CHANNEL_ACCESS_TOKEN: "token",
} as unknown as CloudflareBindings;

const buildBroadcast = (
  overrides: Partial<{
    id: string;
    title: string;
    body: string;
    parts: string | null;
  }> = {},
) =>
  ({
    id: overrides.id ?? "b1",
    title: overrides.title ?? "重要なおしらせ",
    body: overrides.body ?? "本日は休館日です",
    parts: overrides.parts === undefined ? null : overrides.parts,
    status: "sent",
    createdAt: "2030-01-01T00:00:00Z",
    createdBy: "admin",
    updatedAt: null,
    sentAt: null,
    scheduledAt: null,
    errorMessage: null,
  }) as never;

beforeEach(() => {
  vi.mocked(broadcastRepository.findById).mockReset();
  vi.mocked(toLineIds).mockReset();
  vi.mocked(generateReply).mockReset();
  vi.mocked(sendLineMessages).mockReset();
  vi.mocked(createLineClient).mockClear();
  vi.mocked(logger.error).mockReset();
});

describe("handleBroadcastPostback", () => {
  it("broadcast パラメータ無しは invalid", async () => {
    const result = await handleBroadcastPostback(env, "other=1", "tok");
    expect(result).toEqual({ status: "invalid" });
    expect(broadcastRepository.findById).not.toHaveBeenCalled();
  });

  it("該当 broadcast が無ければ invalid", async () => {
    vi.mocked(broadcastRepository.findById).mockResolvedValueOnce(null);
    const result = await handleBroadcastPostback(env, "broadcast=b1", "tok");
    expect(result).toEqual({ status: "invalid" });
  });

  it("該当 broadcast があれば accepted を返す", async () => {
    const broadcast = buildBroadcast({ id: "b1" });
    vi.mocked(broadcastRepository.findById).mockResolvedValueOnce(broadcast);

    const result = await handleBroadcastPostback(env, "broadcast=b1", "tok");

    expect(result).toEqual({
      status: "accepted",
      broadcast,
      replyToken: "tok",
    });
  });
});

describe("generateBroadcastExplanation", () => {
  const setLineIds = () =>
    vi.mocked(toLineIds).mockResolvedValueOnce({
      hashedUserId: "hashed-u",
      resourceId: "res-r",
      threadId: "thr-t",
    });

  it("parts 無しは body を userMessage に含めて呼ぶ", async () => {
    setLineIds();
    vi.mocked(generateReply).mockResolvedValueOnce(["返信1"]);

    const broadcast = buildBroadcast({
      title: "T",
      body: "BODY",
      parts: null,
    });

    await generateBroadcastExplanation(env, "U", broadcast, "tok");

    const arg = vi.mocked(generateReply).mock.calls[0]?.[0] as {
      userMessage: string;
    };
    expect(arg.userMessage).toContain("「T」");
    expect(arg.userMessage).toContain("BODY");
    expect(sendLineMessages).toHaveBeenCalled();
  });

  it("parts (JSON) の text のみ連結する", async () => {
    setLineIds();
    vi.mocked(generateReply).mockResolvedValueOnce(["返信"]);

    const parts = JSON.stringify([
      { type: "text", text: "first" },
      { type: "image", imageUrl: "https://x" },
      { type: "text", text: "second" },
    ]);
    const broadcast = buildBroadcast({ parts, body: "fallback" });

    await generateBroadcastExplanation(env, "U", broadcast, "tok");

    const arg = vi.mocked(generateReply).mock.calls[0]?.[0] as {
      userMessage: string;
    };
    expect(arg.userMessage).toContain("first\n\nsecond");
    expect(arg.userMessage).not.toContain("imageUrl");
  });

  it("parts に text が無ければ body にフォールバック", async () => {
    setLineIds();
    vi.mocked(generateReply).mockResolvedValueOnce(["返信"]);

    const parts = JSON.stringify([{ type: "image", imageUrl: "https://x" }]);
    const broadcast = buildBroadcast({ parts, body: "fallback-body" });

    await generateBroadcastExplanation(env, "U", broadcast, "tok");

    const arg = vi.mocked(generateReply).mock.calls[0]?.[0] as {
      userMessage: string;
    };
    expect(arg.userMessage).toContain("fallback-body");
  });

  it("parts の JSON parse 失敗時は body にフォールバック", async () => {
    setLineIds();
    vi.mocked(generateReply).mockResolvedValueOnce(["返信"]);

    const broadcast = buildBroadcast({
      parts: "not-a-json",
      body: "fallback-body",
    });

    await generateBroadcastExplanation(env, "U", broadcast, "tok");

    const arg = vi.mocked(generateReply).mock.calls[0]?.[0] as {
      userMessage: string;
    };
    expect(arg.userMessage).toContain("fallback-body");
  });

  it("generateReply が空配列を返したら sendLineMessages を呼ばない", async () => {
    setLineIds();
    vi.mocked(generateReply).mockResolvedValueOnce([]);

    await generateBroadcastExplanation(env, "U", buildBroadcast(), "tok");
    expect(sendLineMessages).not.toHaveBeenCalled();
  });

  it("例外は logger.error で握り潰す", async () => {
    setLineIds();
    vi.mocked(generateReply).mockRejectedValueOnce(new Error("agent failed"));

    await expect(
      generateBroadcastExplanation(env, "U", buildBroadcast(), "tok"),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      "[Broadcast] Explanation failed",
      expect.any(Error),
    );
    expect(sendLineMessages).not.toHaveBeenCalled();
  });

  it("送信時は createLineClient とトークンで sendLineMessages を呼ぶ", async () => {
    setLineIds();
    vi.mocked(generateReply).mockResolvedValueOnce(["m1", "m2"]);

    await generateBroadcastExplanation(env, "U", buildBroadcast(), "tok");

    expect(createLineClient).toHaveBeenCalledWith("token");
    const arg = vi.mocked(sendLineMessages).mock.calls[0]?.[0] as {
      replyToken: string;
      texts: string[];
      threadId: string;
      userId: string;
    };
    expect(arg.replyToken).toBe("tok");
    expect(arg.texts).toEqual(["m1", "m2"]);
    expect(arg.threadId).toBe("thr-t");
    expect(arg.userId).toBe("U");
  });
});

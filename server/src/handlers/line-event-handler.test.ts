import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateReply, mockSendLineMessages } = vi.hoisted(() => ({
  mockGenerateReply: vi.fn(),
  mockSendLineMessages: vi.fn(),
}));

vi.mock("~/services/line-messaging", () => ({
  createLineClient: vi.fn().mockReturnValue({}),
  generateReply: mockGenerateReply,
  sendLineMessages: mockSendLineMessages,
}));

const { mockDeleteAllByLineUserId } = vi.hoisted(() => ({
  mockDeleteAllByLineUserId: vi.fn(),
}));

vi.mock("~/services/user-deletion", () => ({
  deleteAllByLineUserId: mockDeleteAllByLineUserId,
}));

const { handleLineEvent } = await import("./line-event-handler");

const env = {
  LINE_CHANNEL_ACCESS_TOKEN: "token",
  RESOURCE_ID_HASH_SECRET: "test-secret",
} as unknown as CloudflareBindings;

const buildMessage = (body: {
  userId: string;
  userMessage?: string;
  replyToken?: string;
  type?: "message" | "unfollow" | "sticker";
}) => ({
  body: {
    type: body.type ?? "message",
    userId: body.userId,
    ...(body.userMessage !== undefined
      ? { userMessage: body.userMessage }
      : {}),
    ...(body.replyToken !== undefined ? { replyToken: body.replyToken } : {}),
  },
  ack: vi.fn(),
  retry: vi.fn(),
  id: "m-1",
  timestamp: new Date(),
  attempts: 1,
});

const buildBatch = (messages: ReturnType<typeof buildMessage>[]) =>
  ({
    messages,
    queue: "line-queue",
    ackAll: vi.fn(),
    retryAll: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
  }) as any;

describe("handleLineEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: generateReply 結果を sendLineMessages に渡して ack", async () => {
    mockGenerateReply.mockResolvedValue(["返信1"]);
    mockSendLineMessages.mockResolvedValue(undefined);

    const msg = buildMessage({
      userId: "U1",
      userMessage: "こんにちは",
      replyToken: "rt",
    });

    await handleLineEvent(buildBatch([msg]), env);

    expect(mockGenerateReply).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: "こんにちは",
        userId: "U1",
        threadId: expect.stringMatching(/^line-thread:[A-Za-z0-9_-]+$/),
        resourceId: expect.stringMatching(/^line:[A-Za-z0-9_-]+$/),
      }),
    );
    const callArg = mockGenerateReply.mock.calls[0]?.[0];
    expect(callArg.threadId).not.toContain("U1");
    expect(callArg.resourceId).not.toContain("U1");
    expect(mockSendLineMessages).toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalled();
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("返信が空配列なら sendLineMessages を呼ばずに ack", async () => {
    mockGenerateReply.mockResolvedValue([]);

    const msg = buildMessage({
      userId: "U1",
      userMessage: "x",
      replyToken: "rt",
    });

    await handleLineEvent(buildBatch([msg]), env);

    expect(mockSendLineMessages).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalled();
  });

  it("generateReply が throw すると retry を呼ぶ", async () => {
    mockGenerateReply.mockRejectedValue(new Error("LLM down"));

    const msg = buildMessage({
      userId: "U1",
      userMessage: "x",
      replyToken: "rt",
    });

    await handleLineEvent(buildBatch([msg]), env);

    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalled();
  });

  it("unfollow は deleteAllByLineUserId を呼んで ack（generateReply は呼ばない）", async () => {
    mockDeleteAllByLineUserId.mockResolvedValue(undefined);

    const msg = buildMessage({ userId: "U-bye", type: "unfollow" });

    await handleLineEvent(buildBatch([msg]), env);

    expect(mockDeleteAllByLineUserId).toHaveBeenCalledWith(env, "U-bye");
    expect(mockGenerateReply).not.toHaveBeenCalled();
    expect(mockSendLineMessages).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalled();
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("sticker はねっぷちゃんの定型文を sendLineMessages で送って ack（generateReply は呼ばない）", async () => {
    mockSendLineMessages.mockResolvedValue(undefined);

    const msg = buildMessage({
      userId: "U-stk",
      replyToken: "rt-stk",
      type: "sticker",
    });

    await handleLineEvent(buildBatch([msg]), env);

    expect(mockGenerateReply).not.toHaveBeenCalled();
    expect(mockSendLineMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        replyToken: "rt-stk",
        userId: "U-stk",
        texts: ["ごめんね、スタンプはわからないんだ〜🥲"],
      }),
    );
    expect(msg.ack).toHaveBeenCalled();
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("sticker の送信が失敗したら retry", async () => {
    mockSendLineMessages.mockRejectedValue(new Error("LINE down"));

    const msg = buildMessage({
      userId: "U-stk",
      replyToken: "rt-stk",
      type: "sticker",
    });

    await handleLineEvent(buildBatch([msg]), env);

    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalled();
  });

  it("unfollow の削除が失敗したら retry", async () => {
    mockDeleteAllByLineUserId.mockRejectedValue(new Error("DB down"));

    const msg = buildMessage({ userId: "U-bye", type: "unfollow" });

    await handleLineEvent(buildBatch([msg]), env);

    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalled();
  });

  it("複数メッセージは個別に処理（1 件失敗しても他は ack）", async () => {
    mockGenerateReply
      .mockResolvedValueOnce(["返信"])
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce([]);
    mockSendLineMessages.mockResolvedValue(undefined);

    const m1 = buildMessage({
      userId: "U1",
      userMessage: "a",
      replyToken: "1",
    });
    const m2 = buildMessage({
      userId: "U2",
      userMessage: "b",
      replyToken: "2",
    });
    const m3 = buildMessage({
      userId: "U3",
      userMessage: "c",
      replyToken: "3",
    });

    await handleLineEvent(buildBatch([m1, m2, m3]), env);

    expect(m1.ack).toHaveBeenCalled();
    expect(m2.retry).toHaveBeenCalled();
    expect(m3.ack).toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { recallMock } = vi.hoisted(() => ({
  recallMock: vi.fn(),
}));

vi.mock("@mastra/memory", () => ({
  Memory: vi.fn(function () {
    return { recall: recallMock };
  }),
}));

vi.mock("@mastra/core/agent", () => ({
  convertMessages: (messages: unknown) => ({
    to: () => messages,
  }),
}));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn(async () => ({})),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getAnswerConversation, resolveAnswerMessageId } = await import(
  "./review"
);

const d1 = {} as D1Database;

const uiMessage = (id: string, role: string, text: string) => ({
  id,
  role,
  parts: [{ type: "text", text }],
});

describe("resolveAnswerMessageId", () => {
  it("messageId があればそのまま返す", () => {
    expect(
      resolveAnswerMessageId({
        threadId: "t-1",
        messageId: "msg-1",
        turnIndex: 2,
      }),
    ).toBe("msg-1");
  });

  it("voice スレッドは turn から決定的 ID を組み立てる", () => {
    expect(
      resolveAnswerMessageId({
        threadId: "voice-thread:abc",
        messageId: null,
        turnIndex: 3,
      }),
    ).toBe("voice-thread:abc:turn:3:assistant");
  });

  it("messageId が無く voice でもなければ null", () => {
    expect(
      resolveAnswerMessageId({
        threadId: "t-1",
        messageId: null,
        turnIndex: 1,
      }),
    ).toBeNull();
  });
});

describe("getAnswerConversation", () => {
  beforeEach(() => {
    recallMock.mockReset();
  });

  it("assistant メッセージと直前の user メッセージを返す", async () => {
    recallMock.mockResolvedValue({
      messages: [
        uiMessage("u1", "user", "バスの時刻は？"),
        uiMessage("a1", "assistant", "8時と17時だよ"),
        uiMessage("u2", "user", "ありがとう"),
        uiMessage("a2", "assistant", "どういたしまして"),
      ],
    });

    const result = await getAnswerConversation(d1, {
      threadId: "t-1",
      messageId: "a1",
      turnIndex: 1,
    });

    expect(result).toEqual({
      question: "バスの時刻は？",
      answer: "8時と17時だよ",
    });
  });

  it("該当メッセージが見つからなければ null", async () => {
    recallMock.mockResolvedValue({ messages: [] });

    const result = await getAnswerConversation(d1, {
      threadId: "t-1",
      messageId: "missing",
      turnIndex: 1,
    });
    expect(result).toBeNull();
  });

  it("recall が失敗しても throw せず null を返す", async () => {
    recallMock.mockRejectedValue(new Error("boom"));

    const result = await getAnswerConversation(d1, {
      threadId: "t-1",
      messageId: "a1",
      turnIndex: 1,
    });
    expect(result).toBeNull();
  });

  it("messageId を解決できなければ recall せず null", async () => {
    const result = await getAnswerConversation(d1, {
      threadId: "t-1",
      messageId: null,
      turnIndex: 1,
    });
    expect(result).toBeNull();
    expect(recallMock).not.toHaveBeenCalled();
  });
});

import type { messagingApi } from "@line/bot-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendLineMessages } from "~/services/line-messaging";

describe("sendLineMessages", () => {
  const mockReplyMessage = vi.fn();
  const mockPushMessage = vi.fn();
  const client = {
    replyMessage: mockReplyMessage,
    pushMessage: mockPushMessage,
  } as unknown as messagingApi.MessagingApiClient;

  const baseParams = {
    client,
    replyToken: "token-123",
    userId: "user-456",
    texts: ["こんにちは", "元気？"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replyMessage で送信成功した場合は pushMessage を呼ばない", async () => {
    mockReplyMessage.mockResolvedValue({});

    await sendLineMessages(baseParams);

    expect(mockReplyMessage).toHaveBeenCalledWith({
      replyToken: "token-123",
      messages: [
        { type: "text", text: "こんにちは" },
        { type: "text", text: "元気？" },
      ],
    });
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("replyMessage 失敗時に pushMessage へフォールバックする", async () => {
    mockReplyMessage.mockRejectedValue(new Error("reply failed"));
    mockPushMessage.mockResolvedValue({});

    await sendLineMessages(baseParams);

    expect(mockReplyMessage).toHaveBeenCalled();
    expect(mockPushMessage).toHaveBeenCalledWith({
      to: "user-456",
      messages: [
        { type: "text", text: "こんにちは" },
        { type: "text", text: "元気？" },
      ],
    });
  });
});

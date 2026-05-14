import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/broadcast-response", () => ({
  generateBroadcastExplanation: vi.fn(),
  handleBroadcastPostback: vi.fn(),
}));

vi.mock("~/services/poll-response", () => ({
  generatePollFollowUp: vi.fn(),
  handlePollPostback: vi.fn(),
}));

const broadcastResponse = await import("~/services/broadcast-response");
const pollResponse = await import("~/services/poll-response");
const { lineRoutes: rawRoutes } = await import("./line");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const CHANNEL_SECRET = "test-channel-secret";

const queueSend = vi.fn();
const waitUntil = vi.fn();

const mockEnv = {
  DB: {} as D1Database,
  LINE_CHANNEL_SECRET: CHANNEL_SECRET,
  LINE_QUEUE: { send: queueSend },
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const sign = (body: string) =>
  crypto.createHmac("sha256", CHANNEL_SECRET).update(body).digest("base64");

const webhookRequest = (body: unknown, signature?: string) => {
  const raw = JSON.stringify(body);
  return new Request("http://localhost/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature !== undefined ? { "x-line-signature": signature } : {}),
    },
    body: raw,
  });
};

const sendWithExecCtx = (req: Request) =>
  routes.fetch(req, mockEnv, { waitUntil } as unknown as ExecutionContext);

const baseTextEvent = {
  type: "message" as const,
  replyToken: "reply-1",
  source: { userId: "U123", type: "user" as const },
  message: { type: "text" as const, id: "m1", text: "こんにちは" },
};

describe("lineRoutes: POST /webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("署名検証", () => {
    it("x-line-signature がない場合は 401", async () => {
      const res = await sendWithExecCtx(
        webhookRequest({ destination: "x", events: [] }),
      );

      expect(res.status).toBe(401);
    });

    it("不正な署名は 401", async () => {
      const res = await sendWithExecCtx(
        webhookRequest({ destination: "x", events: [] }, "invalid-signature"),
      );

      expect(res.status).toBe(401);
    });

    it("正しい署名で 200", async () => {
      const body = JSON.stringify({ destination: "x", events: [] });
      const req = new Request("http://localhost/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-line-signature": sign(body),
        },
        body,
      });

      const res = await sendWithExecCtx(req);

      expect(res.status).toBe(200);
    });
  });

  describe("イベント分岐", () => {
    const sendWebhook = async (events: unknown[]) => {
      const body = JSON.stringify({ destination: "x", events });
      const req = new Request("http://localhost/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-line-signature": sign(body),
        },
        body,
      });
      return await sendWithExecCtx(req);
    };

    it("events が空でも 200", async () => {
      const res = await sendWebhook([]);

      expect(res.status).toBe(200);
      expect(queueSend).not.toHaveBeenCalled();
    });

    it("text message を LINE_QUEUE に送る", async () => {
      const res = await sendWebhook([baseTextEvent]);

      expect(res.status).toBe(200);
      expect(queueSend).toHaveBeenCalledWith({
        type: "message",
        userId: "U123",
        userMessage: "こんにちは",
        replyToken: "reply-1",
      });
    });

    it("unfollow event は { type: 'unfollow', userId } を LINE_QUEUE に送る", async () => {
      const unfollowEvent = {
        type: "unfollow",
        timestamp: 0,
        source: { userId: "U999", type: "user" },
      };

      const res = await sendWebhook([unfollowEvent]);

      expect(res.status).toBe(200);
      expect(queueSend).toHaveBeenCalledWith({
        type: "unfollow",
        userId: "U999",
      });
    });

    it("unfollow event に userId が無ければスキップ", async () => {
      await sendWebhook([
        { type: "unfollow", timestamp: 0, source: { type: "user" } },
      ]);

      expect(queueSend).not.toHaveBeenCalled();
    });

    it("非テキスト message はキューに送らない", async () => {
      const stickerEvent = {
        ...baseTextEvent,
        message: { type: "sticker", id: "s1" },
      };

      await sendWebhook([stickerEvent]);

      expect(queueSend).not.toHaveBeenCalled();
    });

    it("userId / replyToken が無い event はスキップ", async () => {
      await sendWebhook([
        {
          type: "message",
          source: {},
          message: { type: "text", text: "x" },
        },
      ]);

      expect(queueSend).not.toHaveBeenCalled();
    });

    it("postback poll= は handlePollPostback を呼ぶ", async () => {
      vi.mocked(pollResponse.handlePollPostback).mockResolvedValue({
        status: "answered",
        poll: {} as never,
        selectedChoice: "A",
      });

      await sendWebhook([
        {
          type: "postback",
          replyToken: "rt",
          source: { userId: "U1" },
          postback: { data: "poll=p1&choice=A" },
        },
      ]);

      expect(pollResponse.handlePollPostback).toHaveBeenCalledWith(
        mockEnv,
        "U1",
        "poll=p1&choice=A",
        "rt",
      );
      expect(waitUntil).toHaveBeenCalled();
    });

    it("postback poll= で answered 以外なら follow-up は呼ばない", async () => {
      vi.mocked(pollResponse.handlePollPostback).mockResolvedValue({
        status: "already",
        poll: {} as never,
      });

      await sendWebhook([
        {
          type: "postback",
          replyToken: "rt",
          source: { userId: "U1" },
          postback: { data: "poll=p1&choice=A" },
        },
      ]);

      expect(waitUntil).not.toHaveBeenCalled();
    });

    it("postback broadcast= は handleBroadcastPostback を呼ぶ", async () => {
      vi.mocked(broadcastResponse.handleBroadcastPostback).mockResolvedValue({
        status: "accepted",
        broadcast: {} as never,
        replyToken: "rt",
      });

      await sendWebhook([
        {
          type: "postback",
          replyToken: "rt",
          source: { userId: "U1" },
          postback: { data: "broadcast=b1" },
        },
      ]);

      expect(broadcastResponse.handleBroadcastPostback).toHaveBeenCalled();
      expect(waitUntil).toHaveBeenCalled();
    });

    it("postback poll= が throw しても 200 を返す（webhook 単位の安全性）", async () => {
      vi.mocked(pollResponse.handlePollPostback).mockRejectedValue(
        new Error("DB error"),
      );

      const res = await sendWebhook([
        {
          type: "postback",
          replyToken: "rt",
          source: { userId: "U1" },
          postback: { data: "poll=p1" },
        },
      ]);

      expect(res.status).toBe(200);
    });

    it("未知の postback prefix はスキップ", async () => {
      await sendWebhook([
        {
          type: "postback",
          replyToken: "rt",
          source: { userId: "U1" },
          postback: { data: "unknown=x" },
        },
      ]);

      expect(pollResponse.handlePollPostback).not.toHaveBeenCalled();
      expect(broadcastResponse.handleBroadcastPostback).not.toHaveBeenCalled();
    });
  });
});

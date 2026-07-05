import type { UIMessage } from "ai";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw-server";
import { createSimpleChatTransport } from "./simple-chat-transport";

const API_URL = "http://localhost:8787";

const buildMessage = (id: string, role: "user" | "assistant"): UIMessage => ({
  id,
  role,
  parts: [{ type: "text", text: `text-${id}` }],
});

const sseResponse = () =>
  HttpResponse.text("data: [DONE]\n\n", {
    headers: { "content-type": "text/event-stream" },
  });

describe("createSimpleChatTransport", () => {
  it("apiUrl 配下の /simple-chat へ POST する", async () => {
    let requestUrl = "";
    server.use(
      http.post(`${API_URL}/simple-chat`, ({ request }) => {
        requestUrl = request.url;
        return sseResponse();
      }),
    );

    const transport = createSimpleChatTransport({
      apiUrl: API_URL,
      historyLimit: 10,
    });
    await transport.sendMessages({
      trigger: "submit-message",
      chatId: "chat-1",
      messageId: undefined,
      messages: [buildMessage("m-1", "user")],
      abortSignal: undefined,
    });

    expect(requestUrl).toBe(`${API_URL}/simple-chat`);
  });

  it("historyLimit 件数以下ならメッセージをそのまま messages に載せる", async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/simple-chat`, async ({ request }) => {
        receivedBody = await request.json();
        return sseResponse();
      }),
    );

    const messages = [
      buildMessage("m-1", "assistant"),
      buildMessage("m-2", "user"),
    ];
    const transport = createSimpleChatTransport({
      apiUrl: API_URL,
      historyLimit: 10,
    });
    await transport.sendMessages({
      trigger: "submit-message",
      chatId: "chat-1",
      messageId: undefined,
      messages,
      abortSignal: undefined,
    });

    expect(receivedBody).toEqual({ messages });
  });

  it("historyLimit を超える分は直近 N 件にスライスする", async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/simple-chat`, async ({ request }) => {
        receivedBody = await request.json();
        return sseResponse();
      }),
    );

    const messages = [
      buildMessage("m-1", "assistant"),
      buildMessage("m-2", "user"),
      buildMessage("m-3", "assistant"),
      buildMessage("m-4", "user"),
    ];
    const transport = createSimpleChatTransport({
      apiUrl: API_URL,
      historyLimit: 2,
    });
    await transport.sendMessages({
      trigger: "submit-message",
      chatId: "chat-1",
      messageId: undefined,
      messages,
      abortSignal: undefined,
    });

    expect(receivedBody).toEqual({ messages: messages.slice(-2) });
  });

  it("historyLimit: 1 なら直近の 1 件だけを送る", async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/simple-chat`, async ({ request }) => {
        receivedBody = await request.json();
        return sseResponse();
      }),
    );

    const messages = [
      buildMessage("m-1", "assistant"),
      buildMessage("m-2", "user"),
    ];
    const transport = createSimpleChatTransport({
      apiUrl: API_URL,
      historyLimit: 1,
    });
    await transport.sendMessages({
      trigger: "submit-message",
      chatId: "chat-1",
      messageId: undefined,
      messages,
      abortSignal: undefined,
    });

    expect(receivedBody).toEqual({ messages: [messages[1]] });
  });

  it("historyLimit: 0 でも直近 1 件は送る", async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/simple-chat`, async ({ request }) => {
        receivedBody = await request.json();
        return sseResponse();
      }),
    );

    const messages = [
      buildMessage("m-1", "assistant"),
      buildMessage("m-2", "user"),
    ];
    const transport = createSimpleChatTransport({
      apiUrl: API_URL,
      historyLimit: 0,
    });
    await transport.sendMessages({
      trigger: "submit-message",
      chatId: "chat-1",
      messageId: undefined,
      messages,
      abortSignal: undefined,
    });

    expect(receivedBody).toEqual({ messages: [messages[1]] });
  });
});

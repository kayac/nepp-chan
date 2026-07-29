import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { createThreadChatTransport } from "./chat-transport";

const API = "http://localhost:8787";

const sendUserMessage = async (
  transport: ReturnType<typeof createThreadChatTransport>,
  text: string,
) => {
  const stream = await transport.sendMessages({
    chatId: "t-1",
    messageId: "m-1",
    trigger: "submit-message",
    messages: [{ id: "m-1", role: "user", parts: [{ type: "text", text }] }],
    abortSignal: undefined,
  });
  await stream.getReader().read();
};

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("createThreadChatTransport", () => {
  it("スレッドの chat エンドポイントに Bearer 付きで最後のメッセージを送る", async () => {
    let received: {
      auth: string | null;
      body: { message?: { id?: string }; intent?: string };
    } | null = null;
    server.use(
      http.post(`${API}/threads/t-1/chat`, async ({ request }) => {
        received = {
          auth: request.headers.get("authorization"),
          body: (await request.json()) as {
            message?: { id?: string };
            intent?: string;
          },
        };
        return HttpResponse.text('data: {"type":"start"}\n\n', {
          headers: { "content-type": "text/event-stream" },
        });
      }),
    );

    await sendUserMessage(createThreadChatTransport("t-1"), "こんにちは");

    expect(received!.auth).toBe("Bearer admin-token");
    expect(received!.body.message?.id).toBe("m-1");
    expect(received!.body.intent).toBeUndefined();
  });

  it("resolveIntent の結果を intent として送る", async () => {
    let intent: string | undefined;
    server.use(
      http.post(`${API}/threads/t-1/chat`, async ({ request }) => {
        intent = ((await request.json()) as { intent?: string }).intent;
        return HttpResponse.text('data: {"type":"start"}\n\n', {
          headers: { "content-type": "text/event-stream" },
        });
      }),
    );

    await sendUserMessage(
      createThreadChatTransport("t-1", { resolveIntent: () => "casual" }),
      "やあ",
    );

    expect(intent).toBe("casual");
  });
});

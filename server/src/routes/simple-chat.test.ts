import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHandleChatStream, mockRecordLlmUsage } = vi.hoisted(() => ({
  mockHandleChatStream: vi.fn(),
  mockRecordLlmUsage: vi.fn(),
}));

vi.mock("@mastra/ai-sdk", () => ({
  handleChatStream: mockHandleChatStream,
}));

vi.mock("@mastra/core/mastra", () => ({
  Mastra: vi.fn(),
}));

vi.mock("ai", () => ({
  createUIMessageStreamResponse: ({ stream }: { stream: unknown }) =>
    new Response(stream as ReadableStream, {
      headers: { "Content-Type": "text/event-stream" },
    }),
}));

vi.mock("~/mastra/agents/nepp-chan-agent", () => ({
  createNeppChanAgent: vi.fn(),
}));

vi.mock("~/mastra/request-context", () => ({
  createRequestContext: vi.fn(() => ({})),
}));

vi.mock("~/services/analytics/llm-usage", () => ({
  recordLlmUsage: mockRecordLlmUsage,
}));

const { simpleChatRoutes: rawRoutes } = await import("./simple-chat");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const userMessage = (id: string, text: string) => ({
  id,
  role: "user" as const,
  parts: [{ type: "text", text }],
});

const assistantMessage = (id: string, text: string) => ({
  id,
  role: "assistant" as const,
  parts: [{ type: "text", text }],
});

const validBody = { message: userMessage("m-1", "こんにちは") };

const postJson = (body: unknown) =>
  new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const buildStubStream = () =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("data: hello\n\n"));
      controller.close();
    },
  });

describe("simpleChatRoutes: POST /", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleChatStream.mockResolvedValue(buildStubStream());
  });

  it("正常系: 旧形式の message で 200 を返す", async () => {
    const res = await routes.request(postJson(validBody), undefined, mockEnv);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/event-stream/);
  });

  it("正常系: messages 配列で 200 を返す", async () => {
    const res = await routes.request(
      postJson({
        messages: [
          assistantMessage("m-0", "こんにちは〜！"),
          userMessage("m-1", "移住の補助金ある？"),
        ],
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
  });

  it("ストリーム完了時に usage を platform=lp で記録する", async () => {
    await routes.request(postJson(validBody), undefined, mockEnv);

    const { onFinish } = mockHandleChatStream.mock.calls[0][0].params;
    onFinish({
      totalUsage: { inputTokens: 10, outputTokens: 5 },
      model: { modelId: "gemini-2.5-flash-lite" },
    });

    expect(mockRecordLlmUsage).toHaveBeenCalledWith(mockEnv.DB, {
      model: "gemini-2.5-flash-lite",
      usage: { inputTokens: 10, outputTokens: 5 },
      platform: "lp",
      source: "chat",
      intent: "casual",
    });
  });

  it("バリデーション: message も messages も無いと 400", async () => {
    const res = await routes.request(postJson({}), undefined, mockEnv);

    expect(res.status).toBe(400);
    expect(mockHandleChatStream).not.toHaveBeenCalled();
  });

  it("バリデーション: role が enum 外は 400", async () => {
    const res = await routes.request(
      postJson({
        message: {
          id: "m-1",
          role: "robot",
          parts: [{ type: "text", text: "x" }],
        },
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("バリデーション: system role は 400", async () => {
    const res = await routes.request(
      postJson({
        messages: [
          {
            id: "m-1",
            role: "system",
            parts: [{ type: "text", text: "x" }],
          },
        ],
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("バリデーション: parts が配列でないと 400", async () => {
    const res = await routes.request(
      postJson({
        message: { id: "m-1", role: "user", parts: "not-array" },
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("バリデーション: messages が 11 件以上だと 400", async () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0
        ? assistantMessage(`m-${i}`, "こんにちは")
        : userMessage(`m-${i}`, "質問です"),
    );
    messages.push(userMessage("m-last", "最後の質問"));

    const res = await routes.request(
      postJson({ messages }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("バリデーション: 最後の要素が assistant だと 400", async () => {
    const res = await routes.request(
      postJson({
        messages: [
          userMessage("m-1", "質問です"),
          assistantMessage("m-2", "回答です"),
        ],
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("バリデーション: 末尾 user メッセージ単体が 8000 字を超えると 400", async () => {
    const longText = "あ".repeat(8001);
    const res = await routes.request(
      postJson({ messages: [userMessage("m-1", longText)] }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("バリデーション: 末尾 user メッセージが空配列だと 400", async () => {
    const res = await routes.request(
      postJson({
        messages: [{ id: "m-1", role: "user", parts: [] }],
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("バリデーション: 末尾 user メッセージが空文字だと 400", async () => {
    const res = await routes.request(
      postJson({ messages: [userMessage("m-1", "")] }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("正常系: 履歴込み合計が 8000 字を超えても末尾 user が収まっていれば古い履歴を切り捨てて 200", async () => {
    const oldText = "あ".repeat(7000);
    const recentText = "い".repeat(7000);
    const lastText = "う".repeat(100);
    const res = await routes.request(
      postJson({
        messages: [
          assistantMessage("m-old", oldText),
          userMessage("m-mid", recentText),
          userMessage("m-last", lastText),
        ],
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const callArg = mockHandleChatStream.mock.calls[0]?.[0];
    const passedIds = callArg?.params?.messages.map(
      (m: { id: string }) => m.id,
    );
    expect(passedIds).toEqual(["m-mid", "m-last"]);
  });

  it("正常系: サニタイズ後に空になった履歴メッセージは除外される", async () => {
    const res = await routes.request(
      postJson({
        messages: [
          {
            id: "m-old",
            role: "assistant",
            parts: [{ type: "file", url: "x" }],
          },
          userMessage("m-last", "こんにちは"),
        ],
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const callArg = mockHandleChatStream.mock.calls[0]?.[0];
    const passedIds = callArg?.params?.messages.map(
      (m: { id: string }) => m.id,
    );
    expect(passedIds).toEqual(["m-last"]);
  });

  it("非 text パーツはエージェントへの messages から除去される", async () => {
    const filePart = {
      type: "file",
      mediaType: "image/png",
      url: "x".repeat(5000),
    };
    const res = await routes.request(
      postJson({
        messages: [
          {
            id: "m-1",
            role: "user",
            parts: [filePart, { type: "text", text: "こんにちは" }],
          },
        ],
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const callArg = mockHandleChatStream.mock.calls[0]?.[0];
    expect(callArg?.params?.messages).toEqual([
      {
        id: "m-1",
        role: "user",
        parts: [{ type: "text", text: "こんにちは" }],
      },
    ]);
  });

  it("text パーツの未知キーは strip される", async () => {
    const res = await routes.request(
      postJson({
        messages: [
          {
            id: "m-1",
            role: "user",
            parts: [
              { type: "text", text: "こんにちは", evil: "x".repeat(100) },
            ],
          },
        ],
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const callArg = mockHandleChatStream.mock.calls[0]?.[0];
    expect(callArg?.params?.messages).toEqual([
      {
        id: "m-1",
        role: "user",
        parts: [{ type: "text", text: "こんにちは" }],
      },
    ]);
  });

  it("バリデーション: parts が上限件数を超えると 400", async () => {
    const parts = Array.from({ length: 51 }, (_, i) => ({
      type: "text",
      text: `p${i}`,
    }));
    const res = await routes.request(
      postJson({ messages: [{ id: "m-1", role: "user", parts }] }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("バリデーション: id が 128 字を超えると 400", async () => {
    const res = await routes.request(
      postJson({
        messages: [userMessage("m-".padEnd(129, "x"), "こんにちは")],
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("バリデーション: 旧形式 message で role が assistant だと 400", async () => {
    const res = await routes.request(
      postJson({ message: assistantMessage("m-1", "こんにちは") }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("正常系: text parts の合計がちょうど 8000 字なら 200", async () => {
    const longText = "あ".repeat(4000);
    const res = await routes.request(
      postJson({
        messages: [
          assistantMessage("m-1", longText),
          userMessage("m-2", longText),
        ],
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
  });

  it("メッセージを handleChatStream に渡す (旧形式は 1 件配列化)", async () => {
    await routes.request(postJson(validBody), undefined, mockEnv);

    expect(mockHandleChatStream).toHaveBeenCalledTimes(1);
    const callArg = mockHandleChatStream.mock.calls[0]?.[0];
    expect(callArg?.params?.messages).toEqual([validBody.message]);
  });

  it("メッセージを handleChatStream に渡す (messages 配列はそのまま)", async () => {
    const messages = [
      assistantMessage("m-0", "こんにちは〜！"),
      userMessage("m-1", "移住の補助金ある？"),
    ];
    await routes.request(postJson({ messages }), undefined, mockEnv);

    const callArg = mockHandleChatStream.mock.calls[0]?.[0];
    expect(callArg?.params?.messages).toEqual(messages);
  });
});

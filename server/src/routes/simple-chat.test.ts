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

const validBody = {
  message: {
    id: "m-1",
    role: "user" as const,
    parts: [{ type: "text", text: "こんにちは" }],
  },
};

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

  it("正常系: text/event-stream で 200 を返す", async () => {
    const res = await routes.request(postJson(validBody), undefined, mockEnv);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/event-stream/);
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

  it("バリデーション: message なしは 400", async () => {
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

  it("メッセージを handleChatStream に渡す", async () => {
    await routes.request(postJson(validBody), undefined, mockEnv);

    expect(mockHandleChatStream).toHaveBeenCalledTimes(1);
    const callArg = mockHandleChatStream.mock.calls[0]?.[0];
    expect(callArg?.params?.messages).toEqual([validBody.message]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockHandleChatStream,
  mockClassifyIntent,
  mockGetThreadById,
  mockRecordLlmUsage,
} = vi.hoisted(() => ({
  mockHandleChatStream: vi.fn(),
  mockClassifyIntent: vi.fn(),
  mockGetThreadById: vi.fn(),
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

vi.mock("~/lib/classify-intent", () => ({
  classifyIntent: mockClassifyIntent,
}));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));

vi.mock("~/mastra/agents/nepp-chan-agent", () => ({
  createNeppChanAgent: vi.fn(),
}));

vi.mock("~/mastra/request-context", () => ({
  createRequestContext: vi.fn(() => ({})),
}));

vi.mock("@mastra/memory", () => ({
  Memory: vi.fn(function () {
    return {
      listThreads: vi.fn(),
      createThread: vi.fn(),
      recall: vi.fn(),
      getThreadById: mockGetThreadById,
    };
  }),
}));

vi.mock("@mastra/core/agent", () => ({
  convertMessages: () => ({ to: () => [] }),
}));

vi.mock("~/services/thread", () => ({
  deleteThreadWithRelatedData: vi.fn(),
}));

vi.mock("~/services/llm-usage", () => ({
  recordLlmUsage: mockRecordLlmUsage,
}));

vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: { findValid: vi.fn() },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: { findById: vi.fn() },
}));

vi.mock("~/services/auth/anonymous-session", () => ({
  verifyAnonymousToken: vi.fn(),
}));

const sessionService = await import("~/services/auth/anonymous-session");
const { threadsRoutes: rawThreadsRoutes } = await import("./index");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawThreadsRoutes);

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const RES_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const useAnonAuth = () => {
  vi.mocked(sessionService.verifyAnonymousToken).mockResolvedValue(RES_ID);
};

const ownThread = {
  id: "thread-1",
  resourceId: RES_ID,
  title: "x",
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
  metadata: null,
};

const buildReq = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer anon-token",
    },
    body: JSON.stringify(body),
  });

const validBody = {
  message: {
    id: "m-1",
    role: "user" as const,
    parts: [{ type: "text", text: "こんにちは" }],
  },
};

const buildStubStream = () =>
  new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode("data: x\n\n"));
      c.close();
    },
  });

describe("chatRoutes: POST /:threadId/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleChatStream.mockResolvedValue(buildStubStream());
    mockClassifyIntent.mockResolvedValue("casual");
  });

  it("認証なしは 401", async () => {
    mockGetThreadById.mockResolvedValue(ownThread);

    const res = await routes.request(
      new Request("http://localhost/thread-1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(401);
  });

  it("他人のスレッドは 404", async () => {
    useAnonAuth();
    mockGetThreadById.mockResolvedValue({ ...ownThread, resourceId: "別人" });

    const res = await routes.request(
      buildReq("/thread-1/chat", validBody),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(404);
  });

  it("正常系: text/event-stream を返す", async () => {
    useAnonAuth();
    mockGetThreadById.mockResolvedValue(ownThread);

    const res = await routes.request(
      buildReq("/thread-1/chat", validBody),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/event-stream/);
  });

  it("intent 指定があれば classifyIntent を呼ばない", async () => {
    useAnonAuth();
    mockGetThreadById.mockResolvedValue(ownThread);

    await routes.request(
      buildReq("/thread-1/chat", { ...validBody, intent: "thinking" }),
      undefined,
      mockEnv,
    );

    expect(mockClassifyIntent).not.toHaveBeenCalled();
  });

  it("intent 未指定は classifyIntent を呼ぶ", async () => {
    useAnonAuth();
    mockGetThreadById.mockResolvedValue(ownThread);

    await routes.request(
      buildReq("/thread-1/chat", validBody),
      undefined,
      mockEnv,
    );

    expect(mockClassifyIntent).toHaveBeenCalledWith("こんにちは");
  });

  it("text パートが無いメッセージは空文字で classifyIntent を呼ぶ", async () => {
    useAnonAuth();
    mockGetThreadById.mockResolvedValue(ownThread);

    await routes.request(
      buildReq("/thread-1/chat", {
        message: { id: "m-2", role: "user" as const, parts: [] },
      }),
      undefined,
      mockEnv,
    );

    expect(mockClassifyIntent).toHaveBeenCalledWith("");
  });

  it("ストリーム完了時に usage を platform=web で記録する", async () => {
    useAnonAuth();
    mockGetThreadById.mockResolvedValue(ownThread);

    await routes.request(
      buildReq("/thread-1/chat", validBody),
      undefined,
      mockEnv,
    );

    const { onFinish } = mockHandleChatStream.mock.calls[0][0].params;
    onFinish({
      totalUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      model: { modelId: "gemini-2.5-flash-lite" },
    });

    expect(mockRecordLlmUsage).toHaveBeenCalledWith(mockEnv.DB, {
      model: "gemini-2.5-flash-lite",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      platform: "web",
      source: "chat",
      intent: "casual",
      threadId: "thread-1",
    });
  });

  it("usage 記録は modelId 不在時にモデル設定値へフォールバックする", async () => {
    useAnonAuth();
    mockGetThreadById.mockResolvedValue(ownThread);

    await routes.request(
      buildReq("/thread-1/chat", validBody),
      undefined,
      mockEnv,
    );

    const { onFinish } = mockHandleChatStream.mock.calls[0][0].params;
    onFinish({ totalUsage: { inputTokens: 1 } });

    expect(mockRecordLlmUsage).toHaveBeenCalledWith(
      mockEnv.DB,
      expect.objectContaining({ model: "google/gemini-flash-lite-latest" }),
    );
  });

  it("バリデーション: message が enum 外の role なら 400", async () => {
    useAnonAuth();
    mockGetThreadById.mockResolvedValue(ownThread);

    const res = await routes.request(
      buildReq("/thread-1/chat", {
        message: { id: "m1", role: "robot", parts: [] },
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });
});

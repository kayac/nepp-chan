import type { messagingApi } from "@line/bot-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { agentHolder } = vi.hoisted(() => ({
  agentHolder: {
    generate: vi.fn(),
  },
}));

vi.mock("@mastra/core/mastra", () => ({
  Mastra: vi.fn(function () {
    return {
      getAgent: vi.fn(() => agentHolder),
    };
  }),
}));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn(async () => ({ id: "fake-storage" })),
}));

vi.mock("~/mastra/request-context", () => ({
  createRequestContext: vi.fn(() => ({ id: "fake-ctx" })),
}));

vi.mock("~/services/broadcast-thread-injector", () => ({
  injectBroadcastsToThread: vi.fn(async () => undefined),
}));

vi.mock("~/services/poll-thread-injector", () => ({
  injectPollsToThread: vi.fn(async () => undefined),
}));

vi.mock("~/lib/classify-intent", () => ({
  classifyIntent: vi.fn(async () => "casual"),
}));

vi.mock("~/lib/llm-models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/llm-models")>()),
  resolveModelTier: vi.fn(() => ({
    model: [{ model: "fake-model" }],
  })),
}));

vi.mock("~/mastra/agents/nepp-chan-agent", () => ({
  createNeppChanAgent: vi.fn(() => ({ id: "agent" })),
}));

vi.mock("~/lib/strip-markdown", () => ({
  stripMarkdown: vi.fn((s: string) => s.replace(/[*_`]/g, "")),
}));

vi.mock("~/lib/split-message", () => ({
  splitMessagesForLine: vi.fn((texts: string[]) => texts),
}));

vi.mock("~/services/analytics/llm-usage", () => ({
  recordLlmUsage: vi.fn(async () => undefined),
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { classifyIntent } = await import("~/lib/classify-intent");
const { resolveModelTier } = await import("~/lib/llm-models");
const { recordLlmUsage } = await import("~/services/analytics/llm-usage");
const { injectBroadcastsToThread } = await import(
  "~/services/broadcast-thread-injector"
);
const { injectPollsToThread } = await import("~/services/poll-thread-injector");
const { sendLineMessages, generateReply } = await import("./line-messaging");

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
    threadId: "line-thread-hash-abc",
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

describe("generateReply", () => {
  const showLoadingAnimation = vi.fn();
  const client = {
    showLoadingAnimation,
  } as unknown as messagingApi.MessagingApiClient;

  const baseParams = {
    client,
    userMessage: "こんにちは",
    userId: "user-1",
    hashedUserId: "hashed-1",
    resourceId: "res-1",
    threadId: "thr-1",
    env: {
      DB: {} as D1Database,
    } as unknown as CloudflareBindings,
  };

  beforeEach(() => {
    vi.mocked(injectBroadcastsToThread).mockReset().mockResolvedValue();
    vi.mocked(injectPollsToThread).mockReset().mockResolvedValue();
    vi.mocked(classifyIntent).mockReset().mockResolvedValue("casual");
    vi.mocked(resolveModelTier)
      .mockReset()
      .mockReturnValue({
        model: [{ model: "fake-model" }],
      } as never);
    agentHolder.generate.mockReset();
    showLoadingAnimation.mockReset().mockResolvedValue({});
  });

  it("通常系: step.text を返し stripMarkdown を通す", async () => {
    agentHolder.generate.mockResolvedValueOnce({
      steps: [{ text: "*hi*" }, { text: "second" }],
      text: "ignored",
    });

    const result = await generateReply(baseParams);

    expect(result).toEqual(["hi", "second"]);
    expect(injectBroadcastsToThread).toHaveBeenCalled();
    expect(injectPollsToThread).toHaveBeenCalled();
  });

  it("空文字 userMessage の場合は intent=casual のまま (classifyIntent をスキップ)", async () => {
    agentHolder.generate.mockResolvedValueOnce({
      steps: [{ text: "ok" }],
      text: "",
    });

    await generateReply({ ...baseParams, userMessage: "" });

    expect(classifyIntent).not.toHaveBeenCalled();
    expect(resolveModelTier).toHaveBeenCalledWith(
      expect.objectContaining({ intent: "casual" }),
    );
  });

  it("step text が空ならフォールバック text を返す", async () => {
    agentHolder.generate.mockResolvedValueOnce({
      steps: [],
      text: "fallback",
    });

    const result = await generateReply(baseParams);
    expect(result).toEqual(["fallback"]);
  });

  it("step text もフォールバック text も無ければ空配列", async () => {
    agentHolder.generate.mockResolvedValueOnce({
      steps: [],
      text: "",
    });

    const result = await generateReply(baseParams);
    expect(result).toEqual([]);
  });

  it("agent.generate 後に usage を platform=line で記録する", async () => {
    vi.mocked(resolveModelTier).mockReturnValue({
      model: [{ model: "google/gemini-flash-lite-latest" }],
    } as never);
    agentHolder.generate.mockResolvedValueOnce({
      steps: [{ text: "ok" }],
      text: "",
      totalUsage: { inputTokens: 20, outputTokens: 10 },
    });

    await generateReply(baseParams);

    expect(recordLlmUsage).toHaveBeenCalledWith(baseParams.env.DB, {
      model: "google/gemini-flash-lite-latest",
      usage: { inputTokens: 20, outputTokens: 10 },
      platform: "line",
      source: "chat",
      intent: "casual",
      threadId: "thr-1",
    });
  });

  it("agent.generate に resource / thread を渡す", async () => {
    agentHolder.generate.mockResolvedValueOnce({
      steps: [{ text: "x" }],
      text: "x",
    });

    await generateReply(baseParams);
    const arg = agentHolder.generate.mock.calls[0]?.[1] as {
      memory: { resource: string; thread: string };
    };
    expect(arg.memory).toEqual({ resource: "res-1", thread: "thr-1" });
  });

  it("intent 結果は resolveModelTier に流される", async () => {
    vi.mocked(classifyIntent).mockResolvedValueOnce("thinking");
    agentHolder.generate.mockResolvedValueOnce({
      steps: [{ text: "x" }],
      text: "x",
    });

    await generateReply(baseParams);

    expect(resolveModelTier).toHaveBeenCalledWith({
      intent: "thinking",
      platform: "line",
      isAdmin: false,
    });
  });

  it("agent.generate 前に showLoadingAnimation を chatId=userId / loadingSeconds=60 で呼ぶ", async () => {
    agentHolder.generate.mockResolvedValueOnce({
      steps: [{ text: "x" }],
      text: "x",
    });

    await generateReply(baseParams);

    expect(showLoadingAnimation).toHaveBeenCalledWith({
      chatId: "user-1",
      loadingSeconds: 60,
    });
    const loadingCallOrder = showLoadingAnimation.mock.invocationCallOrder[0];
    const generateCallOrder = agentHolder.generate.mock.invocationCallOrder[0];
    expect(loadingCallOrder).toBeLessThan(generateCallOrder!);
  });

  it("showLoadingAnimation の失敗は warn ログのみで generateReply を止めない", async () => {
    showLoadingAnimation.mockRejectedValueOnce(new Error("loading failed"));
    agentHolder.generate.mockResolvedValueOnce({
      steps: [{ text: "ok" }],
      text: "ok",
    });

    await expect(generateReply(baseParams)).resolves.toEqual(["ok"]);
  });

  it("showLoadingAnimation の Promise が未解決でも agent.generate は開始する (fire-and-forget)", async () => {
    let releaseLoading: () => void = () => undefined;
    showLoadingAnimation.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseLoading = resolve;
      }),
    );
    agentHolder.generate.mockResolvedValueOnce({
      steps: [{ text: "ok" }],
      text: "ok",
    });

    const result = await generateReply(baseParams);

    expect(agentHolder.generate).toHaveBeenCalled();
    expect(result).toEqual(["ok"]);
    releaseLoading();
  });
});

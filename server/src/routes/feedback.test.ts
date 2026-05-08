import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/feedback-repository", () => ({
  feedbackRepository: {
    create: vi.fn(),
  },
}));

const { feedbackRepository } = await import("~/repository/feedback-repository");
const { feedbackRoutes: rawFeedbackRoutes } = await import("./feedback");

import { withResolvePrincipal } from "../test-helpers/test-app";

const feedbackRoutes = await withResolvePrincipal(rawFeedbackRoutes);

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const validBody = {
  threadId: "thread-1",
  messageId: "msg-1",
  rating: "good" as const,
  conversationContext: {
    targetMessage: { id: "msg-1", role: "assistant", content: "回答" },
    previousMessages: [],
    nextMessages: [],
  },
};

const postJson = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("feedbackRoutes: POST /", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    "good",
    "bad",
    "idea",
  ] as const)("rating=%s で 201 を返し id を発行する", async (rating) => {
    vi.mocked(feedbackRepository.create).mockResolvedValue("fb-mock-id");

    const res = await feedbackRoutes.request(
      postJson("/", { ...validBody, rating }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
  });

  it("create に rating / category / comment を渡す", async () => {
    vi.mocked(feedbackRepository.create).mockResolvedValue("fb-mock-id");

    await feedbackRoutes.request(
      postJson("/", {
        ...validBody,
        rating: "bad",
        category: "incorrect_fact",
        comment: "事実誤認です",
      }),
      undefined,
      mockEnv,
    );

    const arg = vi.mocked(feedbackRepository.create).mock.calls[0]?.[1];
    expect(arg).toMatchObject({
      threadId: "thread-1",
      messageId: "msg-1",
      rating: "bad",
      category: "incorrect_fact",
      comment: "事実誤認です",
    });
    expect(typeof arg?.id).toBe("string");
    expect(typeof arg?.createdAt).toBe("string");
  });

  it("category / comment / toolExecutions 省略時は null で保存", async () => {
    vi.mocked(feedbackRepository.create).mockResolvedValue("fb-mock-id");

    await feedbackRoutes.request(postJson("/", validBody), undefined, mockEnv);

    const arg = vi.mocked(feedbackRepository.create).mock.calls[0]?.[1];
    expect(arg?.category).toBeNull();
    expect(arg?.comment).toBeNull();
    expect(arg?.toolExecutions).toBeNull();
  });

  it("conversationContext は JSON 文字列に変換される", async () => {
    vi.mocked(feedbackRepository.create).mockResolvedValue("fb-mock-id");

    await feedbackRoutes.request(postJson("/", validBody), undefined, mockEnv);

    const arg = vi.mocked(feedbackRepository.create).mock.calls[0]?.[1];
    expect(typeof arg?.conversationContext).toBe("string");
    expect(JSON.parse(arg?.conversationContext as string)).toEqual(
      validBody.conversationContext,
    );
  });

  it("rating が enum 外なら 400 を返す", async () => {
    const res = await feedbackRoutes.request(
      postJson("/", { ...validBody, rating: "great" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
    expect(feedbackRepository.create).not.toHaveBeenCalled();
  });

  it("threadId が空文字なら 400 を返す", async () => {
    const res = await feedbackRoutes.request(
      postJson("/", { ...validBody, threadId: "" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("境界値: comment 1000 文字ちょうどで 201", async () => {
    vi.mocked(feedbackRepository.create).mockResolvedValue("fb-mock-id");

    const res = await feedbackRoutes.request(
      postJson("/", {
        ...validBody,
        rating: "bad",
        comment: "x".repeat(1000),
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(201);
  });

  it("境界値: comment 1001 文字なら 400", async () => {
    const res = await feedbackRoutes.request(
      postJson("/", {
        ...validBody,
        rating: "bad",
        comment: "x".repeat(1001),
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("body が空オブジェクトなら 400", async () => {
    const res = await feedbackRoutes.request(
      postJson("/", {}),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
    expect(feedbackRepository.create).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetThreadById } = vi.hoisted(() => ({
  mockGetThreadById: vi.fn(),
}));

vi.mock("~/repository/feedback-repository", () => ({
  feedbackRepository: {
    create: vi.fn(),
  },
}));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));

vi.mock("@mastra/memory", () => ({
  Memory: vi.fn(function () {
    return { getThreadById: mockGetThreadById };
  }),
}));

vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: {
    findValid: vi.fn(),
  },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("~/services/auth/anonymous-session", () => ({
  verifyAnonymousToken: vi.fn(),
}));

const { feedbackRepository } = await import("~/repository/feedback-repository");
const { feedbackRoutes: rawFeedbackRoutes } = await import("./feedback");
const sessionService = await import("~/services/auth/anonymous-session");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const feedbackRoutes = await withResolvePrincipal(rawFeedbackRoutes);

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const ANON_RESOURCE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ANON_TOKEN = "valid-anonymous-jwt";

const ownedThread = {
  id: "thread-1",
  resourceId: ANON_RESOURCE_ID,
  title: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
  metadata: null,
};

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

const postJson = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const authedPost = (body: unknown) =>
  postJson(body, { Authorization: `Bearer ${ANON_TOKEN}` });

describe("feedbackRoutes: POST /", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionService.verifyAnonymousToken).mockResolvedValue(
      ANON_RESOURCE_ID,
    );
    mockGetThreadById.mockResolvedValue(ownedThread);
    vi.mocked(feedbackRepository.create).mockResolvedValue("fb-mock-id");
  });

  describe("認証と所有者チェック", () => {
    it("認証なしは 401 で保存しない", async () => {
      const res = await feedbackRoutes.request(
        postJson(validBody),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(401);
      expect(feedbackRepository.create).not.toHaveBeenCalled();
    });

    it("他人の resourceId のスレッドは 404 で保存しない", async () => {
      mockGetThreadById.mockResolvedValue({
        ...ownedThread,
        resourceId: "別人-resource-id",
      });

      const res = await feedbackRoutes.request(
        authedPost(validBody),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({
        error: { message: "スレッドが見つかりません" },
      });
      expect(feedbackRepository.create).not.toHaveBeenCalled();
    });

    it("存在しないスレッドは 404 で保存しない", async () => {
      mockGetThreadById.mockResolvedValue(null);

      const res = await feedbackRoutes.request(
        authedPost(validBody),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(feedbackRepository.create).not.toHaveBeenCalled();
    });

    it("自分のスレッドは 201 で保存する", async () => {
      const res = await feedbackRoutes.request(
        authedPost(validBody),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(201);
      expect(mockGetThreadById).toHaveBeenCalledWith({ threadId: "thread-1" });
      expect(feedbackRepository.create).toHaveBeenCalledTimes(1);
    });
  });

  it.each(["good", "bad", "idea"] as const)(
    "rating=%s で 201 を返し id を発行する",
    async (rating) => {
      const res = await feedbackRoutes.request(
        authedPost({ ...validBody, rating }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: string };
      expect(typeof body.id).toBe("string");
      expect(body.id.length).toBeGreaterThan(0);
    },
  );

  it("create に rating / category / comment を渡す", async () => {
    await feedbackRoutes.request(
      authedPost({
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
    await feedbackRoutes.request(authedPost(validBody), undefined, mockEnv);

    const arg = vi.mocked(feedbackRepository.create).mock.calls[0]?.[1];
    expect(arg?.category).toBeNull();
    expect(arg?.comment).toBeNull();
    expect(arg?.toolExecutions).toBeNull();
  });

  it("conversationContext は JSON 文字列に変換される", async () => {
    await feedbackRoutes.request(authedPost(validBody), undefined, mockEnv);

    const arg = vi.mocked(feedbackRepository.create).mock.calls[0]?.[1];
    expect(typeof arg?.conversationContext).toBe("string");
    expect(JSON.parse(arg?.conversationContext as string)).toEqual(
      validBody.conversationContext,
    );
  });

  it("rating が enum 外なら 400 を返す", async () => {
    const res = await feedbackRoutes.request(
      authedPost({ ...validBody, rating: "great" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
    expect(feedbackRepository.create).not.toHaveBeenCalled();
  });

  it("threadId が空文字なら 400 を返す", async () => {
    const res = await feedbackRoutes.request(
      authedPost({ ...validBody, threadId: "" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("境界値: comment 1000 文字ちょうどで 201", async () => {
    const res = await feedbackRoutes.request(
      authedPost({
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
      authedPost({
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
      authedPost({}),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
    expect(feedbackRepository.create).not.toHaveBeenCalled();
  });
});

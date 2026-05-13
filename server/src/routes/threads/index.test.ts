import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListThreads, mockCreateThread, mockGetThreadById, mockRecall } =
  vi.hoisted(() => ({
    mockListThreads: vi.fn(),
    mockCreateThread: vi.fn(),
    mockGetThreadById: vi.fn(),
    mockRecall: vi.fn(),
  }));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));

vi.mock("@mastra/memory", () => ({
  Memory: vi.fn(function () {
    return {
      listThreads: mockListThreads,
      createThread: mockCreateThread,
      getThreadById: mockGetThreadById,
      recall: mockRecall,
    };
  }),
}));

vi.mock("@mastra/core/agent", () => ({
  convertMessages: (msgs: unknown[]) => ({
    to: () =>
      msgs.map((_m, i) => ({
        id: `ui-${i}`,
        role: "user",
        parts: [{ type: "text", text: "x" }],
      })),
  }),
  Agent: vi.fn(),
}));

vi.mock("~/lib/classify-intent", () => ({
  classifyIntent: vi.fn(),
}));

vi.mock("~/services/thread", () => ({
  deleteThreadWithRelatedData: vi.fn(),
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

const { threadsRoutes: rawThreadsRoutes } = await import("./index");
const { deleteThreadWithRelatedData } = await import("~/services/thread");
const sessionService = await import("~/services/auth/anonymous-session");

import { withResolvePrincipal } from "../../test-helpers/test-app";

const threadsRoutes = await withResolvePrincipal(rawThreadsRoutes);

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const ANON_RESOURCE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ANON_TOKEN = "valid-anonymous-jwt";

const useAnonymousAuth = () => {
  vi.mocked(sessionService.verifyAnonymousToken).mockResolvedValue(
    ANON_RESOURCE_ID,
  );
};

const authedRequest = (
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ANON_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const sampleThread = {
  id: "thread-1",
  resourceId: ANON_RESOURCE_ID,
  title: "サンプル",
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-02T00:00:00Z"),
  metadata: null,
};

describe("threadsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAnonymousAuth();
  });

  describe("認証ガード", () => {
    it.each([
      ["GET", "/"],
      ["POST", "/"],
      ["GET", "/thread-1"],
      ["GET", "/thread-1/messages"],
      ["DELETE", "/thread-1"],
    ])("認証なしで %s %s は 401", async (method, path) => {
      const res = await threadsRoutes.request(
        new Request(`http://localhost${path}`, {
          method,
          headers:
            method === "POST" ? { "Content-Type": "application/json" } : {},
          body: method === "POST" ? "{}" : undefined,
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(401);
    });
  });

  describe("GET /", () => {
    it("正常系: 200 で threads / hasMore / total / page / perPage を返す", async () => {
      mockListThreads.mockResolvedValue({
        threads: [sampleThread],
        hasMore: false,
        total: 1,
      });

      const res = await threadsRoutes.request(
        authedRequest("GET", "/"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        threads: unknown[];
        hasMore: boolean;
        total: number;
        page: number;
        perPage: number;
      };
      expect(body.threads).toHaveLength(1);
      expect(body.hasMore).toBe(false);
      expect(body.total).toBe(1);
      expect(body.page).toBe(0);
      expect(body.perPage).toBe(20);
    });

    it("principal の resourceId で filter する", async () => {
      mockListThreads.mockResolvedValue({
        threads: [],
        hasMore: false,
        total: 0,
      });

      await threadsRoutes.request(
        authedRequest("GET", "/?page=2&perPage=10"),
        undefined,
        mockEnv,
      );

      expect(mockListThreads).toHaveBeenCalledWith({
        filter: { resourceId: ANON_RESOURCE_ID },
        page: 2,
        perPage: 10,
      });
    });

    it("境界値: perPage=1 で 200", async () => {
      mockListThreads.mockResolvedValue({
        threads: [],
        hasMore: false,
        total: 0,
      });

      const res = await threadsRoutes.request(
        authedRequest("GET", "/?perPage=1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("境界値: perPage=100 で 200", async () => {
      mockListThreads.mockResolvedValue({
        threads: [],
        hasMore: false,
        total: 0,
      });

      const res = await threadsRoutes.request(
        authedRequest("GET", "/?perPage=100"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("境界値: perPage=101 は 400", async () => {
      const res = await threadsRoutes.request(
        authedRequest("GET", "/?perPage=101"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("境界値: perPage=0 は 400", async () => {
      const res = await threadsRoutes.request(
        authedRequest("GET", "/?perPage=0"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("境界値: page=-1 は 400", async () => {
      const res = await threadsRoutes.request(
        authedRequest("GET", "/?page=-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });
  });

  describe("POST /", () => {
    it("title なしの空 body でも 201 を返す", async () => {
      mockCreateThread.mockResolvedValue(sampleThread);

      const res = await threadsRoutes.request(
        authedRequest("POST", "/", {}),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(201);
      expect(mockCreateThread).toHaveBeenCalledWith({
        resourceId: ANON_RESOURCE_ID,
        title: undefined,
        metadata: undefined,
      });
    });

    it("title と metadata を渡せる", async () => {
      mockCreateThread.mockResolvedValue(sampleThread);

      await threadsRoutes.request(
        authedRequest("POST", "/", {
          title: "新しいスレッド",
          metadata: { source: "test" },
        }),
        undefined,
        mockEnv,
      );

      expect(mockCreateThread).toHaveBeenCalledWith({
        resourceId: ANON_RESOURCE_ID,
        title: "新しいスレッド",
        metadata: { source: "test" },
      });
    });
  });

  describe("GET /:threadId", () => {
    it("正常系: 自分のスレッドなら 200", async () => {
      mockGetThreadById.mockResolvedValue(sampleThread);

      const res = await threadsRoutes.request(
        authedRequest("GET", "/thread-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string; resourceId: string };
      expect(body.id).toBe("thread-1");
      expect(body.resourceId).toBe(ANON_RESOURCE_ID);
    });

    it("存在しない threadId は 404", async () => {
      mockGetThreadById.mockResolvedValue(null);

      const res = await threadsRoutes.request(
        authedRequest("GET", "/missing"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });

    it("他人の resourceId のスレッドは 404 を返す（情報漏洩防止）", async () => {
      mockGetThreadById.mockResolvedValue({
        ...sampleThread,
        resourceId: "別人-resource-id",
      });

      const res = await threadsRoutes.request(
        authedRequest("GET", "/thread-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /:threadId/messages", () => {
    it("正常系: messages 配列を返す", async () => {
      mockGetThreadById.mockResolvedValue(sampleThread);
      mockRecall.mockResolvedValue({
        messages: [{ id: "m1" }, { id: "m2" }],
      });

      const res = await threadsRoutes.request(
        authedRequest("GET", "/thread-1/messages"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { messages: unknown[] };
      expect(body.messages).toHaveLength(2);
    });

    it("他人のスレッドは 404", async () => {
      mockGetThreadById.mockResolvedValue({
        ...sampleThread,
        resourceId: "別人",
      });

      const res = await threadsRoutes.request(
        authedRequest("GET", "/thread-1/messages"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:threadId", () => {
    it("正常系: 自分のスレッドを削除", async () => {
      mockGetThreadById.mockResolvedValue(sampleThread);
      vi.mocked(deleteThreadWithRelatedData).mockResolvedValue();

      const res = await threadsRoutes.request(
        authedRequest("DELETE", "/thread-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(deleteThreadWithRelatedData).toHaveBeenCalledWith(
        "thread-1",
        mockEnv.DB,
      );
    });

    it("他人のスレッドは 404 で deleteThreadWithRelatedData を呼ばない", async () => {
      mockGetThreadById.mockResolvedValue({
        ...sampleThread,
        resourceId: "別人",
      });

      const res = await threadsRoutes.request(
        authedRequest("DELETE", "/thread-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(deleteThreadWithRelatedData).not.toHaveBeenCalled();
    });

    it("冪等性: 存在しない threadId は 404 を返す", async () => {
      mockGetThreadById.mockResolvedValue(null);

      const res = await threadsRoutes.request(
        authedRequest("DELETE", "/missing"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(deleteThreadWithRelatedData).not.toHaveBeenCalled();
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/feedback-repository", () => ({
  feedbackRepository: {
    list: vi.fn(),
    getStats: vi.fn(),
    count: vi.fn(),
    findById: vi.fn(),
    deleteAll: vi.fn(),
    resolve: vi.fn(),
    unresolve: vi.fn(),
  },
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

const { feedbackRepository } = await import("~/repository/feedback-repository");
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { feedbackAdminRoutes: rawRoutes } = await import("./feedback");

import { withResolvePrincipal } from "../../test-helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const ADMIN_TOKEN = "admin-token";

const adminUser = {
  id: "u-1",
  username: "admin01",
  name: "管理者",
  role: "admin" as "admin" | "staff" | "super_admin",
  passwordHash: "hash",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

const useAdminAuth = (user = adminUser) => {
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token: ADMIN_TOKEN,
    userId: user.id,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockResolvedValue(user);
};

const authed = (method: string, path: string) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });

const sampleRow = {
  id: "fb-1",
  threadId: "t-1",
  messageId: "m-1",
  rating: "good",
  category: null,
  comment: null,
  conversationContext: JSON.stringify({
    targetMessage: { id: "m-1", role: "assistant", content: "x" },
    previousMessages: [],
    nextMessages: [],
  }),
  toolExecutions: null,
  createdAt: "2025-01-01T00:00:00Z",
  resolvedAt: null,
};

const sampleStats = {
  total: 1,
  good: 1,
  bad: 0,
  idea: 0,
  byCategory: {},
};

describe("feedbackAdminRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認可", () => {
    it("staff ロールは 403 を返す", async () => {
      useAdminAuth({ ...adminUser, role: "staff" as const });

      const res = await routes.request(authed("GET", "/"), undefined, mockEnv);

      expect(res.status).toBe(403);
    });

    it("認証なしは 401", async () => {
      const res = await routes.request(
        new Request("http://localhost/", { method: "GET" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(401);
    });
  });

  describe("GET /", () => {
    it("正常系: feedbacks / total / nextCursor / hasMore / stats を返す", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.list).mockResolvedValue({
        feedbacks: [sampleRow],
        nextCursor: null,
        hasMore: false,
      });
      vi.mocked(feedbackRepository.getStats).mockResolvedValue(sampleStats);
      vi.mocked(feedbackRepository.count).mockResolvedValue(1);

      const res = await routes.request(authed("GET", "/"), undefined, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        feedbacks: { id: string }[];
        total: number;
        nextCursor: string | null;
        hasMore: boolean;
        stats: typeof sampleStats;
      };
      expect(body.feedbacks).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(body.nextCursor).toBeNull();
      expect(body.hasMore).toBe(false);
      expect(body.stats).toEqual(sampleStats);
    });

    it("limit 省略時はデフォルト 30 で list を呼ぶ", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.list).mockResolvedValue({
        feedbacks: [],
        nextCursor: null,
        hasMore: false,
      });
      vi.mocked(feedbackRepository.getStats).mockResolvedValue(sampleStats);
      vi.mocked(feedbackRepository.count).mockResolvedValue(0);

      await routes.request(authed("GET", "/"), undefined, mockEnv);

      expect(feedbackRepository.list).toHaveBeenCalledWith(mockEnv.DB, {
        limit: 30,
        cursor: undefined,
        rating: undefined,
      });
    });

    it("rating / cursor をクエリで渡せる", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.list).mockResolvedValue({
        feedbacks: [],
        nextCursor: "next-id",
        hasMore: true,
      });
      vi.mocked(feedbackRepository.getStats).mockResolvedValue(sampleStats);
      vi.mocked(feedbackRepository.count).mockResolvedValue(100);

      await routes.request(
        authed("GET", "/?rating=bad&cursor=cur1&limit=10"),
        undefined,
        mockEnv,
      );

      expect(feedbackRepository.list).toHaveBeenCalledWith(mockEnv.DB, {
        limit: 10,
        cursor: "cur1",
        rating: "bad",
      });
    });

    it("rating が enum 外なら 400", async () => {
      useAdminAuth();

      const res = await routes.request(
        authed("GET", "/?rating=great"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /:id", () => {
    it("正常系: 200 で feedback 詳細を返す", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.findById).mockResolvedValue(sampleRow);

      const res = await routes.request(
        authed("GET", "/fb-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string };
      expect(body.id).toBe("fb-1");
    });

    it("存在しない id は 404", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.findById).mockResolvedValue(null);

      const res = await routes.request(
        authed("GET", "/missing"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:id/resolve", () => {
    it("正常系: resolve を呼んで 200", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.findById).mockResolvedValue(sampleRow);
      vi.mocked(feedbackRepository.resolve).mockResolvedValue();

      const res = await routes.request(
        new Request("http://localhost/fb-1/resolve", {
          method: "PUT",
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(feedbackRepository.resolve).toHaveBeenCalledWith(
        mockEnv.DB,
        "fb-1",
      );
    });

    it("存在しない id は 404 で resolve を呼ばない", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.findById).mockResolvedValue(null);

      const res = await routes.request(
        new Request("http://localhost/missing/resolve", {
          method: "PUT",
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(feedbackRepository.resolve).not.toHaveBeenCalled();
    });

    it("冪等性: 既に resolved な feedback でも 200 を返す", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.findById).mockResolvedValue({
        ...sampleRow,
        resolvedAt: "2025-01-02T00:00:00Z",
      });
      vi.mocked(feedbackRepository.resolve).mockResolvedValue();

      const res = await routes.request(
        new Request("http://localhost/fb-1/resolve", {
          method: "PUT",
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(feedbackRepository.resolve).toHaveBeenCalledTimes(1);
    });
  });

  describe("DELETE /:id/resolve (unresolve)", () => {
    it("正常系: unresolve を呼んで 200", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.findById).mockResolvedValue(sampleRow);
      vi.mocked(feedbackRepository.unresolve).mockResolvedValue();

      const res = await routes.request(
        new Request("http://localhost/fb-1/resolve", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(feedbackRepository.unresolve).toHaveBeenCalledWith(
        mockEnv.DB,
        "fb-1",
      );
    });

    it("存在しない id は 404", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.findById).mockResolvedValue(null);

      const res = await routes.request(
        new Request("http://localhost/missing/resolve", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(feedbackRepository.unresolve).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /", () => {
    it("正常系: count と削除メッセージを返す", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.count).mockResolvedValue(42);
      vi.mocked(feedbackRepository.deleteAll).mockResolvedValue();

      const res = await routes.request(
        authed("DELETE", "/"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { count: number; message: string };
      expect(body.count).toBe(42);
      expect(body.message).toMatch(/42/);
      expect(feedbackRepository.deleteAll).toHaveBeenCalledTimes(1);
    });

    it("境界値: 0 件でも 200 を返す", async () => {
      useAdminAuth();
      vi.mocked(feedbackRepository.count).mockResolvedValue(0);
      vi.mocked(feedbackRepository.deleteAll).mockResolvedValue();

      const res = await routes.request(
        authed("DELETE", "/"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { count: number };
      expect(body.count).toBe(0);
    });
  });
});

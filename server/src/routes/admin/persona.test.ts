import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/persona-repository", () => ({
  personaRepository: { listForAdmin: vi.fn(), topicBreakdown: vi.fn() },
}));

vi.mock("~/services/persona-extractor", () => ({
  extractAllPendingThreads: vi.fn(),
  extractPersonaFromThreadById: vi.fn(),
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

const { personaRepository } = await import("~/repository/persona-repository");
const personaExtractor = await import("~/services/persona-extractor");
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { personaAdminRoutes: rawRoutes } = await import("./persona");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const ADMIN_TOKEN = "a".repeat(64);

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

describe("personaAdminRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認可", () => {
    it("認証なしは 401", async () => {
      const res = await routes.request(
        new Request("http://localhost/", { method: "GET" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(401);
    });

    it("staff ロールでも一覧は取得できる", async () => {
      useAdminAuth({ ...adminUser, role: "staff" as const });
      vi.mocked(personaRepository.listForAdmin).mockResolvedValue({
        personas: [],
        total: 0,
        nextCursor: null,
        hasMore: false,
      });

      const res = await routes.request(authed("GET", "/"), undefined, mockEnv);

      expect(res.status).toBe(200);
    });

    it.each([
      ["POST", "/extract"],
      ["POST", "/extract/thread-1"],
    ])("staff ロールは %s %s を実行できない（admin 以上要件）", async (method, path) => {
      useAdminAuth({ ...adminUser, role: "staff" as const });

      const res = await routes.request(
        authed(method, path),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(403);
    });
  });

  describe("GET /", () => {
    it("正常系: listForAdmin の結果を返す", async () => {
      useAdminAuth();
      vi.mocked(personaRepository.listForAdmin).mockResolvedValue({
        personas: [],
        total: 0,
        nextCursor: null,
        hasMore: false,
      });

      const res = await routes.request(authed("GET", "/"), undefined, mockEnv);

      expect(res.status).toBe(200);
      expect(personaRepository.listForAdmin).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.objectContaining({
          limit: 30,
          cursor: undefined,
        }),
      );
    });

    it("cursor を渡せる", async () => {
      useAdminAuth();
      vi.mocked(personaRepository.listForAdmin).mockResolvedValue({
        personas: [],
        total: 0,
        nextCursor: null,
        hasMore: false,
      });

      await routes.request(
        authed("GET", "/?cursor=abc&limit=5"),
        undefined,
        mockEnv,
      );

      expect(personaRepository.listForAdmin).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.objectContaining({
          limit: 5,
          cursor: "abc",
        }),
      );
    });

    it("期間 query を repository に引き渡す（from/to は JST 日付 → UTC ISO、to はその日を含む）", async () => {
      useAdminAuth();
      vi.mocked(personaRepository.listForAdmin).mockResolvedValue({
        personas: [],
        total: 0,
        nextCursor: null,
        hasMore: false,
      });

      const query = new URLSearchParams({
        from: "2030-01-01",
        to: "2030-02-01",
      });
      await routes.request(
        authed("GET", `/?${query.toString()}`),
        undefined,
        mockEnv,
      );

      expect(personaRepository.listForAdmin).toHaveBeenCalledWith(mockEnv.DB, {
        limit: 30,
        cursor: undefined,
        from: "2029-12-31T15:00:00.000Z",
        to: "2030-02-01T15:00:00.000Z",
      });
    });

    it("日付形式でない from は 400", async () => {
      useAdminAuth();

      const res = await routes.request(
        authed("GET", "/?from=2030-01-01T00:00:00Z"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });
  });

  describe("POST /extract", () => {
    it("正常系: extracted / skipped をカウントしてメッセージを返す", async () => {
      useAdminAuth();
      vi.mocked(personaExtractor.extractAllPendingThreads).mockResolvedValue([
        { threadId: "t1", result: { extracted: true, messageCount: 5 } },
        {
          threadId: "t2",
          result: { skipped: true, reason: "no new messages" },
        },
      ]);

      const res = await routes.request(
        authed("POST", "/extract"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        message: string;
        results: unknown[];
      };
      expect(body.message).toMatch(/1件のスレッド.*1件スキップ/);
      expect(body.results).toHaveLength(2);
    });

    it("境界値: 結果ゼロ件でも 200 を返す", async () => {
      useAdminAuth();
      vi.mocked(personaExtractor.extractAllPendingThreads).mockResolvedValue(
        [],
      );

      const res = await routes.request(
        authed("POST", "/extract"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });
  });

  describe("POST /extract/:threadId", () => {
    it("正常系: extractPersonaFromThreadById の結果を返す", async () => {
      useAdminAuth();
      vi.mocked(
        personaExtractor.extractPersonaFromThreadById,
      ).mockResolvedValue({
        message: "抽出完了",
        result: { extracted: true, messageCount: 3 },
      });

      const res = await routes.request(
        authed("POST", "/extract/thread-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        message: string;
        result: { extracted: boolean };
      };
      expect(body.message).toBe("抽出完了");
      expect(
        personaExtractor.extractPersonaFromThreadById,
      ).toHaveBeenCalledWith("thread-1", mockEnv);
    });
  });

  describe("DELETE /", () => {
    it("一括削除は提供しない（抽出で復元できないため）", async () => {
      useAdminAuth();

      const res = await routes.request(
        authed("DELETE", "/"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });
  });
  describe("GET /topics", () => {
    it("正常系: 集計結果を topics で返す", async () => {
      useAdminAuth();
      vi.mocked(personaRepository.topicBreakdown).mockResolvedValue([
        {
          topic: "生活",
          total: 4,
          sentiments: { positive: 0, negative: 3, request: 1, neutral: 0 },
          sample: "粗大ごみの出し方がわかりにくい",
          topTags: [{ tag: "粗大ごみ", count: 3 }],
        },
      ]);

      const res = await routes.request(
        authed("GET", "/topics"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        topics: { topic: string; total: number }[];
      };
      expect(body.topics[0]).toMatchObject({
        topic: "生活",
        total: 4,
        topTags: [{ tag: "粗大ごみ", count: 3 }],
      });
    });

    it("絞り込み query を repository に引き渡す", async () => {
      useAdminAuth();
      vi.mocked(personaRepository.topicBreakdown).mockResolvedValue([]);

      const query = new URLSearchParams({
        from: "2030-01-01",
        to: "2030-02-01",
        sentiments: "negative,request",
        topic: "生活",
      });
      await routes.request(
        authed("GET", `/topics?${query.toString()}`),
        undefined,
        mockEnv,
      );

      expect(personaRepository.topicBreakdown).toHaveBeenCalledWith(
        mockEnv.DB,
        {
          from: "2029-12-31T15:00:00.000Z",
          to: "2030-02-01T15:00:00.000Z",
          sentiments: ["negative", "request"],
          topic: "生活",
        },
      );
    });

    it("不正な sentiment 値は 400", async () => {
      useAdminAuth();

      const res = await routes.request(
        authed("GET", "/topics?sentiments=angry"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("staff ロールでも参照できる", async () => {
      useAdminAuth({ ...adminUser, role: "staff" as const });
      vi.mocked(personaRepository.topicBreakdown).mockResolvedValue([]);

      const res = await routes.request(
        authed("GET", "/topics"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });
  });
});

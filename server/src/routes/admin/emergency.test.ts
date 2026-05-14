import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/emergency-repository", () => ({
  emergencyRepository: {
    findAll: vi.fn(),
  },
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

const { emergencyRepository } = await import(
  "~/repository/emergency-repository"
);
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const sessionService = await import("~/services/auth/anonymous-session");
const { emergencyAdminRoutes: rawRoutes } = await import("./emergency");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const ADMIN_TOKEN = "admin-session-token";
const STAFF_TOKEN = "staff-session-token";
const ANON_TOKEN = "anonymous-jwt";

const adminUser = {
  id: "u-1",
  username: "admin01",
  name: "管理者",
  role: "admin" as "admin" | "staff" | "super_admin",
  passwordHash: "hash",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};
const staffUser = { ...adminUser, id: "u-2", role: "staff" as const };

const useAdminAuth = (user = adminUser, token = ADMIN_TOKEN) => {
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockResolvedValue(user);
};

const useAnonymousAuth = () => {
  vi.mocked(sessionService.verifyAnonymousToken).mockResolvedValue("anon-uuid");
};

const authedGet = (path: string, token: string) =>
  new Request(`http://localhost${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

const sampleReport = {
  id: "e-1",
  type: "雪害",
  description: "屋根からの落雪",
  location: "音威子府村○○",
  reportedAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

describe("emergencyAdminRoutes: GET /", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認証・認可", () => {
    it("認証なしで 401 を返す", async () => {
      const res = await routes.request(
        new Request("http://localhost/", { method: "GET" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(401);
      expect(emergencyRepository.findAll).not.toHaveBeenCalled();
    });

    it("anonymous principal で 403 を返す", async () => {
      useAnonymousAuth();

      const res = await routes.request(
        authedGet("/", ANON_TOKEN),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(403);
    });

    it.each([
      ["staff", staffUser],
      ["admin", adminUser],
      ["super_admin", { ...adminUser, role: "super_admin" as const }],
    ])("ロール %s は staff 要件を満たし 200 を返す", async (_label, user) => {
      useAdminAuth(user);
      vi.mocked(emergencyRepository.findAll).mockResolvedValue([]);

      const res = await routes.request(
        authedGet("/", STAFF_TOKEN),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });
  });

  describe("正常系", () => {
    it("emergencies と total を返す", async () => {
      useAdminAuth();
      vi.mocked(emergencyRepository.findAll).mockResolvedValue([sampleReport]);

      const res = await routes.request(
        authedGet("/", ADMIN_TOKEN),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        emergencies: (typeof sampleReport)[];
        total: number;
      };
      expect(body.emergencies).toEqual([sampleReport]);
      expect(body.total).toBe(1);
    });

    it("limit 省略時はデフォルト 100 で findAll を呼ぶ", async () => {
      useAdminAuth();
      vi.mocked(emergencyRepository.findAll).mockResolvedValue([]);

      await routes.request(authedGet("/", ADMIN_TOKEN), undefined, mockEnv);

      expect(emergencyRepository.findAll).toHaveBeenCalledWith(mockEnv.DB, 100);
    });

    it("limit クエリを repository に渡す", async () => {
      useAdminAuth();
      vi.mocked(emergencyRepository.findAll).mockResolvedValue([]);

      await routes.request(
        authedGet("/?limit=5", ADMIN_TOKEN),
        undefined,
        mockEnv,
      );

      expect(emergencyRepository.findAll).toHaveBeenCalledWith(mockEnv.DB, 5);
    });
  });

  describe("バリデーション", () => {
    it("境界値: limit=0 は 400", async () => {
      useAdminAuth();

      const res = await routes.request(
        authedGet("/?limit=0", ADMIN_TOKEN),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("境界値: limit=1 は 200", async () => {
      useAdminAuth();
      vi.mocked(emergencyRepository.findAll).mockResolvedValue([]);

      const res = await routes.request(
        authedGet("/?limit=1", ADMIN_TOKEN),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("非数値 limit は 400", async () => {
      useAdminAuth();

      const res = await routes.request(
        authedGet("/?limit=abc", ADMIN_TOKEN),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });
  });
});

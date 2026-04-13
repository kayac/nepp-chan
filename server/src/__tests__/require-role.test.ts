import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { resolvePrincipal } = await import("~/middleware/resolve-principal");
const { requireAuth } = await import("~/middleware/auth");
const { requireRole } = await import("~/middleware/require-role");

describe("requireRole ミドルウェア", () => {
  const mockEnv = {
    DB: {} as D1Database,
    JWT_SECRET: "test-secret-32-chars-long-enough",
  } as unknown as CloudflareBindings;

  const makeUser = (role: string) => ({
    id: "user-1",
    username: "testuser",
    name: "テスト",
    role,
    passwordHash: "100000:salt:hash",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createApp = (minRole: "super_admin" | "admin" | "staff") => {
    const app = new Hono<{ Bindings: CloudflareBindings }>();
    app.use("*", resolvePrincipal);
    app.use("*", requireAuth);
    app.use("*", requireRole(minRole));
    app.get("/test", (c) => c.json({ ok: true }));
    return app;
  };

  const setupAdminSession = (role: string) => {
    vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
      token: "valid-token",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: "2024-01-01T00:00:00Z",
    });
    vi.mocked(adminUserRepository.findById).mockResolvedValue(makeUser(role));
  };

  // biome-ignore lint/suspicious/noExplicitAny: テスト用ヘルパーのため型制約を緩和
  const requestWith = (app: Hono<any>, token = "valid-token") =>
    app.request(
      new Request("http://localhost/test", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      {},
      mockEnv,
    );

  it("未認証の場合は401を返す", async () => {
    const app = createApp("staff");
    const res = await app.request("/test", {}, mockEnv);

    expect(res.status).toBe(401);
  });

  describe("staff ロール要求", () => {
    it("staff はアクセスできる", async () => {
      setupAdminSession("staff");
      const res = await requestWith(createApp("staff"));
      expect(res.status).toBe(200);
    });

    it("admin はアクセスできる", async () => {
      setupAdminSession("admin");
      const res = await requestWith(createApp("staff"));
      expect(res.status).toBe(200);
    });

    it("super_admin はアクセスできる", async () => {
      setupAdminSession("super_admin");
      const res = await requestWith(createApp("staff"));
      expect(res.status).toBe(200);
    });
  });

  describe("admin ロール要求", () => {
    it("staff は403を返す", async () => {
      setupAdminSession("staff");
      const res = await requestWith(createApp("admin"));
      expect(res.status).toBe(403);
    });

    it("admin はアクセスできる", async () => {
      setupAdminSession("admin");
      const res = await requestWith(createApp("admin"));
      expect(res.status).toBe(200);
    });

    it("super_admin はアクセスできる", async () => {
      setupAdminSession("super_admin");
      const res = await requestWith(createApp("admin"));
      expect(res.status).toBe(200);
    });
  });

  describe("super_admin ロール要求", () => {
    it("staff は403を返す", async () => {
      setupAdminSession("staff");
      const res = await requestWith(createApp("super_admin"));
      expect(res.status).toBe(403);
    });

    it("admin は403を返す", async () => {
      setupAdminSession("admin");
      const res = await requestWith(createApp("super_admin"));
      expect(res.status).toBe(403);
    });

    it("super_admin はアクセスできる", async () => {
      setupAdminSession("super_admin");
      const res = await requestWith(createApp("super_admin"));
      expect(res.status).toBe(200);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/admin-invitation-repository", () => ({
  adminInvitationRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("~/services/auth/invitation", () => ({
  createInvitation: vi.fn(),
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

const { adminInvitationRepository } = await import(
  "~/repository/admin-invitation-repository"
);
const invitationService = await import("~/services/auth/invitation");
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { invitationRoutes: rawRoutes } = await import("./invitations");

import { withResolvePrincipal } from "../../test-helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const TOKEN = "admin-token";
const adminUser = {
  id: "u-1",
  username: "admin01",
  name: "管理者",
  role: "admin" as "admin" | "staff" | "super_admin",
  passwordHash: "hash",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};
const superAdminUser = {
  ...adminUser,
  id: "u-2",
  role: "super_admin" as const,
};

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const useAuth = (user = adminUser) => {
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token: TOKEN,
    userId: user.id,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockResolvedValue(user);
};

const authedJson = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const sampleInvitation = {
  id: "inv-1",
  username: "newuser",
  token: "tok-1",
  invitedBy: "u-1",
  role: "staff" as const,
  expiresAt: "2025-12-31T00:00:00Z",
  usedAt: null,
  createdAt: "2025-01-01T00:00:00Z",
};

describe("invitationRoutes", () => {
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

    it("staff ロールは 403", async () => {
      useAuth({ ...adminUser, role: "staff" as const });

      const res = await routes.request(
        authedJson("GET", "/"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(403);
    });
  });

  describe("GET /", () => {
    it("正常系: 招待一覧を返す", async () => {
      useAuth();
      vi.mocked(adminInvitationRepository.list).mockResolvedValue([
        sampleInvitation,
      ]);

      const res = await routes.request(
        authedJson("GET", "/"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { invitations: { id: string }[] };
      expect(body.invitations).toHaveLength(1);
      expect(body.invitations[0].id).toBe("inv-1");
    });
  });

  describe("POST /", () => {
    it("admin が staff を招待できる", async () => {
      useAuth();
      vi.mocked(invitationService.createInvitation).mockResolvedValue({
        id: "inv-1",
        username: "newuser",
        token: "tok-1",
        expiresAt: new Date("2025-12-31T00:00:00Z"),
      });

      const res = await routes.request(
        authedJson("POST", "/", { username: "newuser", role: "staff" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        invitation: { token: string };
      };
      expect(body.invitation.token).toBe("tok-1");
    });

    // role 省略時は staff デフォルト → admin が招待可能
    it("role 省略時は staff（admin が招待可能）", async () => {
      useAuth();
      vi.mocked(invitationService.createInvitation).mockResolvedValue({
        id: "inv-1",
        username: "newuser",
        token: "tok-1",
        expiresAt: new Date("2025-12-31T00:00:00Z"),
      });

      await routes.request(
        authedJson("POST", "/", { username: "newuser" }),
        undefined,
        mockEnv,
      );

      expect(invitationService.createInvitation).toHaveBeenCalledWith(
        mockEnv.DB,
        "newuser",
        "u-1",
        "staff",
        1,
      );
    });

    // 認可境界: admin は admin / super_admin の招待を作れない
    it.each([
      "admin",
      "super_admin",
    ] as const)("admin ロールが role=%s を招待しようとして 403", async (role) => {
      useAuth();

      const res = await routes.request(
        authedJson("POST", "/", { username: "x", role }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(403);
      expect(invitationService.createInvitation).not.toHaveBeenCalled();
    });

    it("super_admin は admin / super_admin を招待できる", async () => {
      useAuth(superAdminUser);
      vi.mocked(invitationService.createInvitation).mockResolvedValue({
        id: "inv-1",
        username: "newuser",
        token: "tok-1",
        expiresAt: new Date("2025-12-31T00:00:00Z"),
      });

      const res = await routes.request(
        authedJson("POST", "/", { username: "newuser", role: "admin" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("username が空文字なら 400", async () => {
      useAuth();

      const res = await routes.request(
        authedJson("POST", "/", { username: "", role: "staff" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("createInvitation が throw すると 400 を返す", async () => {
      useAuth();
      vi.mocked(invitationService.createInvitation).mockRejectedValue(
        new Error("既に登録済み"),
      );

      const res = await routes.request(
        authedJson("POST", "/", { username: "newuser" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { message: string } };
      expect(body.error.message).toBe("既に登録済み");
    });
  });

  describe("DELETE /:id", () => {
    it("正常系: 削除", async () => {
      useAuth();
      vi.mocked(adminInvitationRepository.findById).mockResolvedValue(
        sampleInvitation,
      );
      vi.mocked(adminInvitationRepository.delete).mockResolvedValue();

      const res = await routes.request(
        authedJson("DELETE", "/inv-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(adminInvitationRepository.delete).toHaveBeenCalledWith(
        mockEnv.DB,
        "inv-1",
      );
    });

    it("存在しない id は 404", async () => {
      useAuth();
      vi.mocked(adminInvitationRepository.findById).mockResolvedValue(null);

      const res = await routes.request(
        authedJson("DELETE", "/missing"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(adminInvitationRepository.delete).not.toHaveBeenCalled();
    });
  });
});

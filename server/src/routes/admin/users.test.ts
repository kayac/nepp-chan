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

vi.mock("~/services/auth/admin-user", () => ({
  deleteAdminUser: vi.fn(),
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
const { deleteAdminUser } = await import("~/services/auth/admin-user");
const { userAdminRoutes: rawRoutes } = await import("./users");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const TOKEN = "a".repeat(64);
const superAdminUser = {
  id: "u-super",
  username: "super01",
  name: "スーパー管理者",
  role: "super_admin" as "admin" | "staff" | "super_admin",
  passwordHash: "hash",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};
const targetUser = {
  ...superAdminUser,
  id: "u-target",
  username: "target01",
  role: "staff" as const,
};

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const useAuth = (user = superAdminUser) => {
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token: TOKEN,
    userId: user.id,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockImplementation(async (_d1, id) =>
    id === user.id ? user : null,
  );
};

const authedDelete = (path: string) =>
  new Request(`http://localhost${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

describe("userAdminRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認可", () => {
    it("認証なしは 401", async () => {
      const res = await routes.request(
        new Request("http://localhost/u-target", { method: "DELETE" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(401);
    });

    it.each(["staff", "admin"] as const)("%s ロールは 403", async (role) => {
      useAuth({ ...superAdminUser, role });

      const res = await routes.request(
        authedDelete("/u-target"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(403);
      expect(deleteAdminUser).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /:id", () => {
    it("正常系: ユーザー・セッション・招待を削除する", async () => {
      useAuth();
      vi.mocked(adminUserRepository.findById).mockImplementation(
        async (_d1, id) => {
          if (id === superAdminUser.id) return superAdminUser;
          if (id === targetUser.id) return targetUser;
          return null;
        },
      );

      const res = await routes.request(
        authedDelete("/u-target"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(deleteAdminUser).toHaveBeenCalledWith(mockEnv.DB, targetUser);
    });

    it("存在しない id は 404", async () => {
      useAuth();

      const res = await routes.request(
        authedDelete("/missing"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(deleteAdminUser).not.toHaveBeenCalled();
    });

    it("自分自身は削除できず 400", async () => {
      useAuth();

      const res = await routes.request(
        authedDelete("/u-super"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(deleteAdminUser).not.toHaveBeenCalled();
    });
  });
});

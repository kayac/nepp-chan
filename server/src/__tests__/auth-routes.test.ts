import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/password", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("~/lib/crypto", () => ({
  generateId: vi.fn(() => "generated-id"),
}));

vi.mock("~/repository/admin-invitation-repository", () => ({
  adminInvitationRepository: {
    findValidByToken: vi.fn(),
    markUsed: vi.fn(),
  },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: {
    findByUsername: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("~/services/auth/token", () => ({
  generateAccessToken: vi.fn(),
  verifyAccessToken: vi.fn(),
}));

const { hashPassword, verifyPassword } = await import("~/lib/password");
const { adminInvitationRepository } = await import(
  "~/repository/admin-invitation-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const tokenService = await import("~/services/auth/token");
const { authRoutes: rawAuthRoutes } = await import("~/routes/auth");

import { withResolveAuth } from "./helpers/test-app";

const authRoutes = await withResolveAuth(rawAuthRoutes);

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const postJson = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const testUser = {
  id: "user-1",
  username: "admin01",
  name: "管理者",
  role: "admin",
  passwordHash: "100000:salt:hash",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: null,
};

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Register ---

  describe("POST /register", () => {
    const validInvitation = {
      id: "inv-1",
      username: "newuser",
      token: "valid-token",
      invitedBy: "admin",
      role: "admin",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      usedAt: null,
      createdAt: "2024-01-01T00:00:00Z",
    };

    it("有効な招待トークンとパスワードで登録できる", async () => {
      vi.mocked(adminInvitationRepository.findValidByToken).mockResolvedValue(
        validInvitation,
      );
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);
      vi.mocked(hashPassword).mockResolvedValue("hashed-password");
      vi.mocked(adminUserRepository.create).mockResolvedValue("user-1");
      vi.mocked(tokenService.generateAccessToken).mockResolvedValue(
        "access-token-jwt",
      );

      const res = await authRoutes.request(
        postJson("/register", {
          token: "valid-token",
          password: "password123",
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        accessToken: "access-token-jwt",
        user: {
          id: "generated-id",
          username: "newuser",
          name: null,
          role: "admin",
        },
      });
      expect(adminInvitationRepository.markUsed).toHaveBeenCalledWith(
        mockEnv.DB,
        "inv-1",
      );
    });

    it("無効な招待トークンで 400 を返す", async () => {
      vi.mocked(adminInvitationRepository.findValidByToken).mockResolvedValue(
        null,
      );

      const res = await authRoutes.request(
        postJson("/register", { token: "invalid", password: "password123" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("既に登録済みのユーザー名で 400 を返す", async () => {
      vi.mocked(adminInvitationRepository.findValidByToken).mockResolvedValue(
        validInvitation,
      );
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(testUser);

      const res = await authRoutes.request(
        postJson("/register", {
          token: "valid-token",
          password: "password123",
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("8文字未満のパスワードでバリデーションエラーになる", async () => {
      const res = await authRoutes.request(
        postJson("/register", { token: "valid-token", password: "short" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });
  });

  // --- Login ---

  describe("POST /login", () => {
    it("正しい認証情報でログインできる", async () => {
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(testUser);
      vi.mocked(verifyPassword).mockResolvedValue(true);
      vi.mocked(tokenService.generateAccessToken).mockResolvedValue(
        "access-token-jwt",
      );

      const res = await authRoutes.request(
        postJson("/login", { username: "admin01", password: "password123" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        accessToken: "access-token-jwt",
        user: {
          id: "user-1",
          username: "admin01",
          name: "管理者",
          role: "admin",
        },
      });
    });

    it("存在しないユーザー名で 401 を返す", async () => {
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);

      const res = await authRoutes.request(
        postJson("/login", { username: "unknown", password: "password123" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(401);
    });

    it("間違ったパスワードで 401 を返す", async () => {
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(testUser);
      vi.mocked(verifyPassword).mockResolvedValue(false);

      const res = await authRoutes.request(
        postJson("/login", { username: "admin01", password: "wrong" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(401);
    });

    it("ユーザー名をそのままリポジトリに渡す（正規化はリポジトリ層で実施）", async () => {
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);

      await authRoutes.request(
        postJson("/login", {
          username: "  Admin01  ",
          password: "password123",
        }),
        undefined,
        mockEnv,
      );

      expect(adminUserRepository.findByUsername).toHaveBeenCalledWith(
        mockEnv.DB,
        "  Admin01  ",
      );
    });
  });

  // --- Me ---

  describe("GET /me", () => {
    it("有効な Access Token でユーザー情報を返す", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(testUser);

      const res = await authRoutes.request(
        new Request("http://localhost/me", {
          headers: { Authorization: "Bearer valid-token" },
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        user: {
          id: "user-1",
          username: "admin01",
          name: "管理者",
          role: "admin",
        },
      });
    });

    it("Authorization ヘッダーなしで user: null を返す", async () => {
      const res = await authRoutes.request(
        new Request("http://localhost/me"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ user: null });
    });

    it("無効なトークンで user: null を返す", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockRejectedValue(
        new Error("invalid"),
      );

      const res = await authRoutes.request(
        new Request("http://localhost/me", {
          headers: { Authorization: "Bearer invalid-token" },
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ user: null });
    });
  });

  // --- Logout ---

  describe("POST /logout", () => {
    it("ログアウトメッセージを返す", async () => {
      const res = await authRoutes.request(
        new Request("http://localhost/logout", { method: "POST" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ message: "ログアウトしました" });
    });
  });
});

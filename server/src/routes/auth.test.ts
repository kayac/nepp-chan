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
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: {
    create: vi.fn(),
    findValid: vi.fn(),
    deleteByToken: vi.fn(),
  },
}));

vi.mock("~/services/auth/anonymous-session", () => ({
  verifyAnonymousToken: vi.fn(),
  generateAnonymousToken: vi.fn(
    async (resourceId: string) => `token-for-${resourceId}`,
  ),
}));

const { hashPassword, verifyPassword } = await import("~/lib/password");
const { adminInvitationRepository } = await import(
  "~/repository/admin-invitation-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { authRoutes: rawAuthRoutes } = await import("./auth");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const authRoutes = await withResolvePrincipal(rawAuthRoutes);

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
      vi.mocked(adminSessionRepository.create).mockResolvedValue(
        "opaque-session-token",
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
        accessToken: "opaque-session-token",
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

    it("境界値: ちょうど 8 文字のパスワードで登録できる", async () => {
      vi.mocked(adminInvitationRepository.findValidByToken).mockResolvedValue(
        validInvitation,
      );
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);
      vi.mocked(hashPassword).mockResolvedValue("hashed-password");
      vi.mocked(adminUserRepository.create).mockResolvedValue("user-1");
      vi.mocked(adminSessionRepository.create).mockResolvedValue("token");

      const res = await authRoutes.request(
        postJson("/register", { token: "valid-token", password: "12345678" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("境界値: 7 文字のパスワードでバリデーションエラー", async () => {
      const res = await authRoutes.request(
        postJson("/register", { token: "valid-token", password: "1234567" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("無効トークン時の message が「無効」を含む", async () => {
      vi.mocked(adminInvitationRepository.findValidByToken).mockResolvedValue(
        null,
      );

      const res = await authRoutes.request(
        postJson("/register", { token: "x", password: "password123" }),
        undefined,
        mockEnv,
      );

      const body = (await res.json()) as { error?: { message?: string } };
      expect(body.error?.message).toMatch(/無効|期限切れ/);
    });

    it("ユーザー名重複時の message が「既に」を含む", async () => {
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

      const body = (await res.json()) as { error?: { message?: string } };
      expect(body.error?.message).toMatch(/既に/);
    });

    it("登録成功時に markUsed 後に user を作成する（順序検証）", async () => {
      vi.mocked(adminInvitationRepository.findValidByToken).mockResolvedValue(
        validInvitation,
      );
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);
      vi.mocked(hashPassword).mockResolvedValue("hashed-password");
      vi.mocked(adminUserRepository.create).mockResolvedValue("user-1");
      vi.mocked(adminSessionRepository.create).mockResolvedValue("token");

      await authRoutes.request(
        postJson("/register", {
          token: "valid-token",
          password: "password123",
        }),
        undefined,
        mockEnv,
      );

      expect(adminUserRepository.create).toHaveBeenCalledTimes(1);
      expect(adminInvitationRepository.markUsed).toHaveBeenCalledTimes(1);
    });

    it("create に渡される passwordHash は平文と異なる", async () => {
      vi.mocked(adminInvitationRepository.findValidByToken).mockResolvedValue(
        validInvitation,
      );
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(null);
      vi.mocked(hashPassword).mockResolvedValue("hashed-output");
      vi.mocked(adminUserRepository.create).mockResolvedValue("user-1");
      vi.mocked(adminSessionRepository.create).mockResolvedValue("token");

      await authRoutes.request(
        postJson("/register", {
          token: "valid-token",
          password: "plaintext-password",
        }),
        undefined,
        mockEnv,
      );

      const callArg = vi.mocked(adminUserRepository.create).mock.calls[0]?.[1];
      expect(callArg?.passwordHash).toBe("hashed-output");
      expect(callArg?.passwordHash).not.toContain("plaintext-password");
    });
  });

  // --- Login ---

  describe("POST /login", () => {
    it("正しい認証情報でログインできる", async () => {
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(testUser);
      vi.mocked(verifyPassword).mockResolvedValue(true);
      vi.mocked(adminSessionRepository.create).mockResolvedValue(
        "opaque-session-token",
      );

      const res = await authRoutes.request(
        postJson("/login", { username: "admin01", password: "password123" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        accessToken: "opaque-session-token",
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

    // ユーザー存在しない / パスワード違い で同じ message を返すことで、
    // どちらが間違っているかを攻撃者に教えない仕様を担保する。
    it("ユーザー不在と password 不一致で同一の 401 message を返す", async () => {
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValueOnce(null);

      const resNoUser = await authRoutes.request(
        postJson("/login", { username: "ghost", password: "password123" }),
        undefined,
        mockEnv,
      );

      vi.mocked(adminUserRepository.findByUsername).mockResolvedValueOnce(
        testUser,
      );
      vi.mocked(verifyPassword).mockResolvedValueOnce(false);

      const resWrongPw = await authRoutes.request(
        postJson("/login", { username: "admin01", password: "wrong" }),
        undefined,
        mockEnv,
      );

      const a = (await resNoUser.json()) as { error?: { message?: string } };
      const b = (await resWrongPw.json()) as { error?: { message?: string } };
      expect(a.error?.message).toBe(b.error?.message);
      expect(a.error?.message).toMatch(/正しくありません/);
    });

    it("ログイン失敗時に adminSessionRepository.create を呼ばない", async () => {
      vi.mocked(adminUserRepository.findByUsername).mockResolvedValue(testUser);
      vi.mocked(verifyPassword).mockResolvedValue(false);

      await authRoutes.request(
        postJson("/login", { username: "admin01", password: "wrong" }),
        undefined,
        mockEnv,
      );

      expect(adminSessionRepository.create).not.toHaveBeenCalled();
    });
  });

  // --- Me ---

  describe("GET /me", () => {
    it("有効な opaque session でユーザー情報を返す", async () => {
      const opaqueToken = "a".repeat(64);
      vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
        token: opaqueToken,
        userId: "user-1",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: "2024-01-01T00:00:00Z",
      });
      vi.mocked(adminUserRepository.findById).mockResolvedValue(testUser);

      const res = await authRoutes.request(
        new Request("http://localhost/me", {
          headers: { Authorization: `Bearer ${opaqueToken}` },
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
      vi.mocked(adminSessionRepository.findValid).mockResolvedValue(undefined);

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

    it("Basic 認証 header では user: null を返す", async () => {
      const res = await authRoutes.request(
        new Request("http://localhost/me", {
          headers: { Authorization: "Basic dXNlcjpwYXNz" },
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

    it("Bearer トークンを deleteByToken に渡す", async () => {
      vi.mocked(adminSessionRepository.deleteByToken).mockResolvedValue();

      await authRoutes.request(
        new Request("http://localhost/logout", {
          method: "POST",
          headers: { Authorization: "Bearer my-session-token" },
        }),
        undefined,
        mockEnv,
      );

      expect(adminSessionRepository.deleteByToken).toHaveBeenCalledWith(
        mockEnv.DB,
        "my-session-token",
      );
    });

    it("冪等性: 同じトークンで 2 回 logout しても 200 を返す", async () => {
      vi.mocked(adminSessionRepository.deleteByToken).mockResolvedValue();

      const make = () =>
        authRoutes.request(
          new Request("http://localhost/logout", {
            method: "POST",
            headers: { Authorization: "Bearer same-token" },
          }),
          undefined,
          mockEnv,
        );

      const res1 = await make();
      const res2 = await make();

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(adminSessionRepository.deleteByToken).toHaveBeenCalledTimes(2);
    });

    it("Authorization なしでは deleteByToken を呼ばない", async () => {
      await authRoutes.request(
        new Request("http://localhost/logout", { method: "POST" }),
        undefined,
        mockEnv,
      );

      expect(adminSessionRepository.deleteByToken).not.toHaveBeenCalled();
    });
  });

  // --- Anonymous Session ---

  describe("POST /anonymous-session", () => {
    const UUID_V4_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    it("body なしでは widget- prefix の無い UUID の resourceId を発行する", async () => {
      const res = await authRoutes.request(
        new Request("http://localhost/anonymous-session", { method: "POST" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { token: string; resourceId: string };
      expect(body.resourceId).toMatch(UUID_V4_REGEX);
      expect(typeof body.token).toBe("string");
    });

    it("platform: widget を指定すると widget- prefix 付きの resourceId を発行する", async () => {
      const res = await authRoutes.request(
        postJson("/anonymous-session", { platform: "widget" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { token: string; resourceId: string };
      expect(body.resourceId.startsWith("widget-")).toBe(true);
      expect(body.resourceId.slice("widget-".length)).toMatch(UUID_V4_REGEX);
    });
  });
});

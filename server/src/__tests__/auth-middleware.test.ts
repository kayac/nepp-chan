import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as tokenService from "~/services/auth/token";

vi.mock("~/services/auth/token", () => ({
  verifyAccessToken: vi.fn(),
}));

const { resolveAuth, requireAuth } = await import("~/middleware/auth");

describe("auth ミドルウェア", () => {
  const mockEnv = {
    DB: {} as D1Database,
    JWT_SECRET: "test-secret-32-chars-long-enough",
  } as unknown as CloudflareBindings;

  const testUser = {
    id: "user-1",
    username: "admin01",
    name: "管理者",
    role: "admin",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveAuth", () => {
    const createApp = () => {
      const app = new Hono<{
        Bindings: CloudflareBindings;
        Variables: { adminUser?: typeof testUser };
      }>();
      app.use("*", resolveAuth);
      app.get("/public", (c) => {
        const user = c.get("adminUser");
        return c.json({ user: user ?? null, authenticated: !!user });
      });
      return app;
    };

    type PublicResponse = {
      user: typeof testUser | null;
      authenticated: boolean;
    };

    it("Authorizationヘッダーがない場合でもリクエストは通る", async () => {
      const app = createApp();

      const res = await app.request("/public", {}, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as PublicResponse;
      expect(body.user).toBeNull();
      expect(body.authenticated).toBe(false);
    });

    it("無効なトークンの場合でもリクエストは通る", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockRejectedValue(
        new Error("invalid"),
      );

      const app = createApp();
      const req = new Request("http://localhost/public", {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      const res = await app.request(req, {}, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as PublicResponse;
      expect(body.user).toBeNull();
      expect(body.authenticated).toBe(false);
    });

    it("有効なトークンの場合はユーザー情報をコンテキストに設定する", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(testUser);

      const app = createApp();
      const req = new Request("http://localhost/public", {
        headers: {
          Authorization: "Bearer valid-jwt-token",
        },
      });

      const res = await app.request(req, {}, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as PublicResponse;
      expect(body.user).toEqual(testUser);
      expect(body.authenticated).toBe(true);
    });
  });

  describe("requireAuth", () => {
    const createApp = () => {
      const app = new Hono<{
        Bindings: CloudflareBindings;
        Variables: { adminUser?: typeof testUser };
      }>();
      app.use("*", resolveAuth);
      app.use("*", requireAuth);
      app.get("/protected", (c) => {
        const user = c.get("adminUser");
        return c.json({ user });
      });
      return app;
    };

    it("トークンがない場合は401を返す", async () => {
      const app = createApp();

      const res = await app.request("/protected", {}, mockEnv);

      expect(res.status).toBe(401);
      const body = await res.text();
      expect(body).toBe("認証が必要です");
    });

    it("無効なトークンの場合は401を返す", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockRejectedValue(
        new Error("invalid"),
      );

      const app = createApp();
      const req = new Request("http://localhost/protected", {
        headers: {
          Authorization: "Bearer invalid-jwt-token",
        },
      });

      const res = await app.request(req, {}, mockEnv);

      expect(res.status).toBe(401);
      const body = await res.text();
      expect(body).toBe("認証が必要です");
    });

    it("有効なトークンの場合はユーザー情報をコンテキストに設定する", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(testUser);

      const app = createApp();
      const req = new Request("http://localhost/protected", {
        headers: {
          Authorization: "Bearer valid-jwt-token",
        },
      });

      const res = await app.request(req, {}, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { user: typeof testUser };
      expect(body.user).toEqual(testUser);
    });
  });
});

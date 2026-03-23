import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as sessionService from "~/services/auth/session";

vi.mock("~/services/auth/session", () => ({
  verifyAccessToken: vi.fn(),
}));

const { sessionAuth, optionalSessionAuth } = await import(
  "~/middleware/session-auth"
);

describe("session-auth ミドルウェア", () => {
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

  describe("sessionAuth", () => {
    const createApp = () => {
      const app = new Hono<{
        Bindings: CloudflareBindings;
        Variables: { adminUser: typeof testUser };
      }>();
      app.use("*", sessionAuth);
      app.get("/protected", (c) => {
        const user = c.get("adminUser");
        return c.json({ user });
      });
      return app;
    };

    it("Authorizationヘッダーがない場合は401を返す", async () => {
      const app = createApp();

      const res = await app.request("/protected", {}, mockEnv);

      expect(res.status).toBe(401);
      const body = await res.text();
      expect(body).toBe("認証トークンがありません");
    });

    it("無効なトークンの場合は401を返す", async () => {
      vi.mocked(sessionService.verifyAccessToken).mockRejectedValue(
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
      expect(body).toBe("無効なトークンです");
    });

    it("有効なトークンの場合はユーザー情報をコンテキストに設定する", async () => {
      vi.mocked(sessionService.verifyAccessToken).mockResolvedValue({
        sub: testUser.id,
        username: testUser.username,
        name: testUser.name,
        role: testUser.role,
        iss: "nepp-chan",
        aud: "nepp-chan-admin",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      });

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

  describe("optionalSessionAuth", () => {
    const createApp = () => {
      const app = new Hono<{
        Bindings: CloudflareBindings;
        Variables: { adminUser?: typeof testUser };
      }>();
      app.use("*", optionalSessionAuth);
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
      vi.mocked(sessionService.verifyAccessToken).mockRejectedValue(
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
      vi.mocked(sessionService.verifyAccessToken).mockResolvedValue({
        sub: testUser.id,
        username: testUser.username,
        name: testUser.name,
        role: testUser.role,
        iss: "nepp-chan",
        aud: "nepp-chan-admin",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      });

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
});

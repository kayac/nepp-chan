import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as sessionService from "~/services/auth/session";

vi.mock("~/services/auth/session", () => ({
  getUserFromSession: vi.fn(),
}));

// テスト対象をモック後にインポート
const { sessionAuth, optionalSessionAuth, SESSION_COOKIE_NAME } = await import(
  "~/middleware/session-auth"
);

describe("session-auth ミドルウェア", () => {
  const mockDb = {} as D1Database;
  const mockEnv = { DB: mockDb } as CloudflareBindings;

  const testUser = {
    id: "user-1",
    email: "admin@example.com",
    name: "管理者",
    role: "admin" as const,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: null,
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

    it("セッションCookieがない場合は401を返す", async () => {
      const app = createApp();

      const res = await app.request("/protected", {}, mockEnv);

      expect(res.status).toBe(401);
      const body = await res.text();
      expect(body).toBe("セッションがありません");
    });

    it("無効なセッションの場合は401を返す", async () => {
      vi.mocked(sessionService.getUserFromSession).mockResolvedValue(null);

      const app = createApp();
      const req = new Request("http://localhost/protected", {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=invalid-session-id`,
        },
      });

      const res = await app.request(req, {}, mockEnv);

      expect(res.status).toBe(401);
      const body = await res.text();
      expect(body).toBe("無効なセッションです");
      expect(sessionService.getUserFromSession).toHaveBeenCalledWith(
        mockDb,
        "invalid-session-id",
      );
    });

    it("有効なセッションの場合はユーザー情報をコンテキストに設定する", async () => {
      vi.mocked(sessionService.getUserFromSession).mockResolvedValue(testUser);

      const app = createApp();
      const req = new Request("http://localhost/protected", {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=valid-session-id`,
        },
      });

      const res = await app.request(req, {}, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { user: typeof testUser };
      expect(body.user).toEqual(testUser);
    });

    it("getUserFromSession が正しいパラメータで呼ばれる", async () => {
      vi.mocked(sessionService.getUserFromSession).mockResolvedValue(testUser);

      const app = createApp();
      const sessionId = "test-session-abc123";
      const req = new Request("http://localhost/protected", {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        },
      });

      await app.request(req, {}, mockEnv);

      expect(sessionService.getUserFromSession).toHaveBeenCalledWith(
        mockDb,
        sessionId,
      );
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

    it("セッションCookieがない場合でもリクエストは通る", async () => {
      const app = createApp();

      const res = await app.request("/public", {}, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as PublicResponse;
      expect(body.user).toBeNull();
      expect(body.authenticated).toBe(false);
    });

    it("無効なセッションの場合でもリクエストは通る", async () => {
      vi.mocked(sessionService.getUserFromSession).mockResolvedValue(null);

      const app = createApp();
      const req = new Request("http://localhost/public", {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=invalid-session-id`,
        },
      });

      const res = await app.request(req, {}, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as PublicResponse;
      expect(body.user).toBeNull();
      expect(body.authenticated).toBe(false);
    });

    it("有効なセッションの場合はユーザー情報をコンテキストに設定する", async () => {
      vi.mocked(sessionService.getUserFromSession).mockResolvedValue(testUser);

      const app = createApp();
      const req = new Request("http://localhost/public", {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=valid-session-id`,
        },
      });

      const res = await app.request(req, {}, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as PublicResponse;
      expect(body.user).toEqual(testUser);
      expect(body.authenticated).toBe(true);
    });

    it("セッションCookieがない場合はgetUserFromSessionを呼ばない", async () => {
      const app = createApp();

      await app.request("/public", {}, mockEnv);

      expect(sessionService.getUserFromSession).not.toHaveBeenCalled();
    });
  });

  describe("SESSION_COOKIE_NAME", () => {
    it("Cookie名は __session である", () => {
      expect(SESSION_COOKIE_NAME).toBe("__session");
    });
  });
});

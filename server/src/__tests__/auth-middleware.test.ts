import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Principal } from "~/lib/principal";
import * as sessionService from "~/services/auth/anonymous-session";
import * as tokenService from "~/services/auth/token";

vi.mock("~/services/auth/token", () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock("~/services/auth/anonymous-session", () => ({
  verifyAnonymousToken: vi.fn(),
}));

const { resolvePrincipal } = await import("~/middleware/resolve-principal");
const { requireAuth } = await import("~/middleware/auth");

describe("requireAuth", () => {
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

  const createApp = () => {
    const app = new Hono<{
      Bindings: CloudflareBindings;
      Variables: { principal?: Principal };
    }>();
    app.use("*", resolvePrincipal);
    app.use("*", requireAuth);
    app.get("/protected", (c) => {
      const principal = c.get("principal");
      return c.json({ principal });
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
    vi.mocked(sessionService.verifyAnonymousToken).mockRejectedValue(
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

  it("有効な Admin JWT で principal がセットされる", async () => {
    vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(testUser);

    const app = createApp();
    const req = new Request("http://localhost/protected", {
      headers: {
        Authorization: "Bearer valid-jwt-token",
      },
    });

    const res = await app.request(req, {}, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { principal: Principal };
    expect(body.principal.type).toBe("admin");
  });

  it("有効な Anonymous JWT で principal がセットされる", async () => {
    vi.mocked(tokenService.verifyAccessToken).mockRejectedValue(
      new Error("invalid aud"),
    );
    vi.mocked(sessionService.verifyAnonymousToken).mockResolvedValue(
      "resource-uuid",
    );

    const app = createApp();
    const req = new Request("http://localhost/protected", {
      headers: {
        Authorization: "Bearer valid-anonymous-token",
      },
    });

    const res = await app.request(req, {}, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { principal: Principal };
    expect(body.principal.type).toBe("anonymous");
  });
});

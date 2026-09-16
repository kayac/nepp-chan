import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Principal } from "~/lib/principal";

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
const sessionService = await import("~/services/auth/anonymous-session");
const { resolvePrincipal } = await import("./resolve-principal");
const { requireAuth } = await import("./auth");

describe("requireAuth", () => {
  const mockEnv = {
    DB: {} as D1Database,
    JWT_SECRET: "test-secret-32-chars-long-enough",
  } as unknown as CloudflareBindings;

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
    vi.mocked(adminSessionRepository.findValid).mockResolvedValue(undefined);
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
});

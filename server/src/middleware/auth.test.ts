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
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const sessionService = await import("~/services/auth/anonymous-session");
const { resolvePrincipal } = await import("./resolve-principal");
const { requireAuth } = await import("./auth");

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
    passwordHash: "100000:salt:hash",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: null,
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

  it("有効な Admin opaque session で principal がセットされる", async () => {
    vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
      token: "valid-jwt-token",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: "2024-01-01T00:00:00Z",
    });
    vi.mocked(adminUserRepository.findById).mockResolvedValue(testUser);

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
    vi.mocked(adminSessionRepository.findValid).mockResolvedValue(undefined);
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

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

type TestResponse = {
  principal: Principal | null;
};

const createApp = () => {
  const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { principal?: Principal };
  }>();
  app.use("*", resolvePrincipal);
  app.get("/test", (c) =>
    c.json({
      principal: c.get("principal") ?? null,
    }),
  );
  return app;
};

describe("resolvePrincipal", () => {
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

  it("トークンなしでもリクエストは通る（principal は null）", async () => {
    const res = await createApp().request("/test", {}, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as TestResponse;
    expect(body.principal).toBeNull();
  });

  const validOpaqueToken = "a".repeat(64);

  it("Admin opaque session → AdminPrincipal", async () => {
    vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
      token: validOpaqueToken,
      userId: "user-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: "2024-01-01T00:00:00Z",
    });
    vi.mocked(adminUserRepository.findById).mockResolvedValue(testUser);

    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${validOpaqueToken}` },
    });
    const res = await createApp().request(req, {}, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as TestResponse;
    expect(body.principal).toEqual({
      type: "admin",
      id: "user-1",
      user: {
        id: "user-1",
        username: "admin01",
        name: "管理者",
        role: "admin",
      },
    });
  });

  it("Anonymous JWT → AnonymousPrincipal", async () => {
    vi.mocked(adminSessionRepository.findValid).mockResolvedValue(undefined);
    vi.mocked(sessionService.verifyAnonymousToken).mockResolvedValue(
      "resource-uuid-1234",
    );

    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer valid-anonymous-token" },
    });
    const res = await createApp().request(req, {}, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as TestResponse;
    expect(body.principal).toEqual({
      type: "anonymous",
      id: "resource-uuid-1234",
    });
  });

  it("Admin opaque session が優先される", async () => {
    vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
      token: validOpaqueToken,
      userId: "user-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: "2024-01-01T00:00:00Z",
    });
    vi.mocked(adminUserRepository.findById).mockResolvedValue(testUser);

    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${validOpaqueToken}` },
    });
    const res = await createApp().request(req, {}, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as TestResponse;
    expect(body.principal?.type).toBe("admin");
    expect(sessionService.verifyAnonymousToken).not.toHaveBeenCalled();
  });

  it("無効なトークン → principal は null", async () => {
    vi.mocked(adminSessionRepository.findValid).mockResolvedValue(undefined);
    vi.mocked(sessionService.verifyAnonymousToken).mockRejectedValue(
      new Error("invalid"),
    );

    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${validOpaqueToken}` },
    });
    const res = await createApp().request(req, {}, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as TestResponse;
    expect(body.principal).toBeNull();
  });

  it("opaque 形式でないトークンは admin DB を引かない（旧 JWT を含む不正トークン耐性）", async () => {
    vi.mocked(sessionService.verifyAnonymousToken).mockRejectedValue(
      new Error("invalid"),
    );

    const legacyJwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4In0.signature";
    const req = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${legacyJwt}` },
    });
    const res = await createApp().request(req, {}, mockEnv);

    expect(res.status).toBe(200);
    expect(adminSessionRepository.findValid).not.toHaveBeenCalled();
    expect(sessionService.verifyAnonymousToken).toHaveBeenCalledWith(
      legacyJwt,
      "test-secret-32-chars-long-enough",
    );
    const body = (await res.json()) as TestResponse;
    expect(body.principal).toBeNull();
  });
});

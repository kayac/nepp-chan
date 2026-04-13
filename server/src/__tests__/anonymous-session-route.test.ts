import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/auth/anonymous-session", () => ({
  generateAnonymousToken: vi.fn().mockResolvedValue("mock-jwt-token"),
  isValidUuidV4: vi.fn((v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    ),
  ),
}));

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

const { authRoutes: rawAuthRoutes } = await import("~/routes/auth");

import { withResolvePrincipal } from "./helpers/test-app";

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

describe("POST /anonymous-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("新規 resourceId でトークンを発行できる", async () => {
    const resourceId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    const res = await authRoutes.request(
      postJson("/anonymous-session", { resourceId }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      token: "mock-jwt-token",
      resourceId,
    });
  });

  it("resourceId 省略時はサーバーで生成する", async () => {
    const res = await authRoutes.request(
      postJson("/anonymous-session", {}),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; resourceId: string };
    expect(body.token).toBe("mock-jwt-token");
    expect(body.resourceId).toBeDefined();
  });

  it("UUID v4 以外の形式は 400 を返す", async () => {
    const res = await authRoutes.request(
      postJson("/anonymous-session", { resourceId: "line:user123" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("不正な UUID 形式は 400 を返す", async () => {
    const res = await authRoutes.request(
      postJson("/anonymous-session", { resourceId: "not-a-uuid" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/auth/anonymous-session", () => ({
  generateAnonymousToken: vi.fn().mockResolvedValue("mock-jwt-token"),
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

describe("POST /anonymous-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("サーバー生成の resourceId でトークンを発行できる", async () => {
    const res = await authRoutes.request(
      new Request("http://localhost/anonymous-session", { method: "POST" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; resourceId: string };
    expect(body.token).toBe("mock-jwt-token");
    expect(body.resourceId).toBeDefined();
    expect(body.resourceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

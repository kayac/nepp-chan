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

  it("Admin JWT → AdminPrincipal", async () => {
    vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(testUser);

    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer valid-admin-token" },
    });
    const res = await createApp().request(req, {}, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as TestResponse;
    expect(body.principal).toEqual({
      type: "admin",
      id: "user-1",
      user: testUser,
    });
  });

  it("Anonymous JWT → AnonymousPrincipal", async () => {
    // admin verify が失敗 → anonymous verify が成功
    vi.mocked(tokenService.verifyAccessToken).mockRejectedValue(
      new Error("invalid aud"),
    );
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

  it("Admin JWT が優先される（aud で判定）", async () => {
    vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(testUser);

    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer admin-token" },
    });
    const res = await createApp().request(req, {}, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as TestResponse;
    expect(body.principal?.type).toBe("admin");
    // anonymous verify は呼ばれない
    expect(sessionService.verifyAnonymousToken).not.toHaveBeenCalled();
  });

  it("無効なトークン → principal は null", async () => {
    vi.mocked(tokenService.verifyAccessToken).mockRejectedValue(
      new Error("invalid"),
    );
    vi.mocked(sessionService.verifyAnonymousToken).mockRejectedValue(
      new Error("invalid"),
    );

    const req = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    const res = await createApp().request(req, {}, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as TestResponse;
    expect(body.principal).toBeNull();
  });
});

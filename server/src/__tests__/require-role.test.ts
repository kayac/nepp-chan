import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as tokenService from "~/services/auth/token";

vi.mock("~/services/auth/token", () => ({
  verifyAccessToken: vi.fn(),
}));

const { resolveAuth, requireAuth } = await import("~/middleware/auth");
const { requireRole } = await import("~/middleware/require-role");

describe("requireRole ミドルウェア", () => {
  const mockEnv = {
    DB: {} as D1Database,
    JWT_SECRET: "test-secret-32-chars-long-enough",
  } as unknown as CloudflareBindings;

  const makeUser = (role: string) => ({
    id: "user-1",
    username: "testuser",
    name: "テスト",
    role,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createApp = (minRole: "super_admin" | "admin" | "staff") => {
    const app = new Hono<{
      Bindings: CloudflareBindings;
      Variables: { adminUser?: ReturnType<typeof makeUser> };
    }>();
    app.use("*", resolveAuth);
    app.use("*", requireAuth);
    app.use("*", requireRole(minRole));
    app.get("/test", (c) => c.json({ ok: true }));
    return app;
  };

  // biome-ignore lint/suspicious/noExplicitAny: テスト用ヘルパーのため型制約を緩和
  const requestWith = (app: Hono<any>, token = "valid-token") =>
    app.request(
      new Request("http://localhost/test", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      {},
      mockEnv,
    );

  it("未認証の場合は401を返す", async () => {
    const app = createApp("staff");
    const res = await app.request("/test", {}, mockEnv);

    expect(res.status).toBe(401);
  });

  describe("staff ロール要求", () => {
    it("staff はアクセスできる", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(
        makeUser("staff"),
      );
      const res = await requestWith(createApp("staff"));
      expect(res.status).toBe(200);
    });

    it("admin はアクセスできる", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(
        makeUser("admin"),
      );
      const res = await requestWith(createApp("staff"));
      expect(res.status).toBe(200);
    });

    it("super_admin はアクセスできる", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(
        makeUser("super_admin"),
      );
      const res = await requestWith(createApp("staff"));
      expect(res.status).toBe(200);
    });
  });

  describe("admin ロール要求", () => {
    it("staff は403を返す", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(
        makeUser("staff"),
      );
      const res = await requestWith(createApp("admin"));
      expect(res.status).toBe(403);
    });

    it("admin はアクセスできる", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(
        makeUser("admin"),
      );
      const res = await requestWith(createApp("admin"));
      expect(res.status).toBe(200);
    });

    it("super_admin はアクセスできる", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(
        makeUser("super_admin"),
      );
      const res = await requestWith(createApp("admin"));
      expect(res.status).toBe(200);
    });
  });

  describe("super_admin ロール要求", () => {
    it("staff は403を返す", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(
        makeUser("staff"),
      );
      const res = await requestWith(createApp("super_admin"));
      expect(res.status).toBe(403);
    });

    it("admin は403を返す", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(
        makeUser("admin"),
      );
      const res = await requestWith(createApp("super_admin"));
      expect(res.status).toBe(403);
    });

    it("super_admin はアクセスできる", async () => {
      vi.mocked(tokenService.verifyAccessToken).mockResolvedValue(
        makeUser("super_admin"),
      );
      const res = await requestWith(createApp("super_admin"));
      expect(res.status).toBe(200);
    });
  });
});

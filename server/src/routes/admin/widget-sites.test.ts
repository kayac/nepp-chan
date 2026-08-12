import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: { findValid: vi.fn() },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: { findById: vi.fn() },
}));

vi.mock("~/repository/widget-site-repository", () => ({
  widgetSiteRepository: {
    findByHost: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
const { widgetSiteRepository } = await import(
  "~/repository/widget-site-repository"
);
const { widgetSiteAdminRoutes: rawRoutes } = await import("./widget-sites");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const TOKEN = "a".repeat(64);
const superAdminUser = {
  id: "u-super",
  username: "super01",
  name: "スーパー管理者",
  role: "super_admin" as "admin" | "staff" | "super_admin",
  passwordHash: "hash",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const site = {
  id: "ws-1",
  host: "vill.otoineppu.hokkaido.jp",
  instructions: "行政手続きの案内を優先する",
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: null,
};

const useAuth = (user = superAdminUser) => {
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token: TOKEN,
    userId: user.id,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockImplementation(async (_d1, id) =>
    id === user.id ? user : null,
  );
};

const authed = (path: string, method: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe("widgetSiteAdminRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認可", () => {
    it("認証なしは 401", async () => {
      const res = await routes.request(
        new Request("http://localhost/"),
        undefined,
        mockEnv,
      );
      expect(res.status).toBe(401);
    });

    it.each(["staff", "admin"] as const)("%s ロールは 403", async (role) => {
      useAuth({ ...superAdminUser, role });

      const res = await routes.request(authed("/", "GET"), undefined, mockEnv);

      expect(res.status).toBe(403);
      expect(widgetSiteRepository.list).not.toHaveBeenCalled();
    });
  });

  it("一覧を返す", async () => {
    useAuth();
    vi.mocked(widgetSiteRepository.list).mockResolvedValue([site]);

    const res = await routes.request(authed("/", "GET"), undefined, mockEnv);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sites: [site] });
  });

  it("新しい設置サイトを登録する", async () => {
    useAuth();
    vi.mocked(widgetSiteRepository.findByHost).mockResolvedValue(null);
    vi.mocked(widgetSiteRepository.create).mockResolvedValue(site);

    const res = await routes.request(
      authed("/", "POST", {
        host: "www.vill.otoineppu.hokkaido.jp",
        instructions: "行政手続きの案内を優先する",
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(site);
    expect(widgetSiteRepository.create).toHaveBeenCalledWith(
      mockEnv.DB,
      expect.objectContaining({
        host: "www.vill.otoineppu.hokkaido.jp",
        instructions: "行政手続きの案内を優先する",
      }),
    );
  });

  it("登録済みドメインの再登録は 409", async () => {
    useAuth();
    vi.mocked(widgetSiteRepository.findByHost).mockResolvedValue(site);

    const res = await routes.request(
      authed("/", "POST", {
        host: "vill.otoineppu.hokkaido.jp",
        instructions: "案内文",
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(409);
    expect(widgetSiteRepository.create).not.toHaveBeenCalled();
  });

  it("host が空なら 400", async () => {
    useAuth();

    const res = await routes.request(
      authed("/", "POST", { host: "", instructions: "案内文" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
  });

  it("設置サイトを更新する", async () => {
    useAuth();
    vi.mocked(widgetSiteRepository.findById).mockResolvedValue(site);
    vi.mocked(widgetSiteRepository.findByHost).mockResolvedValue(site);
    vi.mocked(widgetSiteRepository.update).mockResolvedValue({
      ...site,
      instructions: "書き換えた案内文",
    });

    const res = await routes.request(
      authed("/ws-1", "PUT", {
        host: "vill.otoineppu.hokkaido.jp",
        instructions: "書き換えた案内文",
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ...site,
      instructions: "書き換えた案内文",
    });
    expect(widgetSiteRepository.update).toHaveBeenCalledWith(
      mockEnv.DB,
      "ws-1",
      {
        host: "vill.otoineppu.hokkaido.jp",
        instructions: "書き換えた案内文",
      },
    );
  });

  it("他サイトが使っているドメインへの更新は 409", async () => {
    useAuth();
    vi.mocked(widgetSiteRepository.findById).mockResolvedValue(site);
    vi.mocked(widgetSiteRepository.findByHost).mockResolvedValue({
      ...site,
      id: "ws-2",
    });

    const res = await routes.request(
      authed("/ws-1", "PUT", {
        host: "example.com",
        instructions: "案内文",
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(409);
    expect(widgetSiteRepository.update).not.toHaveBeenCalled();
  });

  it("存在しない id の更新は 404", async () => {
    useAuth();
    vi.mocked(widgetSiteRepository.findById).mockResolvedValue(null);

    const res = await routes.request(
      authed("/missing", "PUT", {
        host: "example.com",
        instructions: "案内文",
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(404);
  });

  it("設置サイトを削除する", async () => {
    useAuth();
    vi.mocked(widgetSiteRepository.findById).mockResolvedValue(site);

    const res = await routes.request(
      authed("/ws-1", "DELETE"),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(widgetSiteRepository.delete).toHaveBeenCalledWith(
      mockEnv.DB,
      "ws-1",
    );
  });

  it("存在しない id の削除は 404", async () => {
    useAuth();
    vi.mocked(widgetSiteRepository.findById).mockResolvedValue(null);

    const res = await routes.request(
      authed("/missing", "DELETE"),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(404);
    expect(widgetSiteRepository.delete).not.toHaveBeenCalled();
  });
});

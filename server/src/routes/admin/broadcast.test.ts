import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/broadcast-repository", () => ({
  broadcastRepository: {
    findAll: vi.fn(),
    count: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("~/services/broadcast-service", () => ({
  createBroadcastMessage: vi.fn(),
  sendBroadcast: vi.fn(),
  updateBroadcastMessage: vi.fn(),
}));

vi.mock("~/lib/image-converter", () => ({
  convertToMarkdown: vi.fn().mockResolvedValue("画像説明"),
}));

vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: { findValid: vi.fn() },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: { findById: vi.fn() },
}));

vi.mock("~/services/auth/anonymous-session", () => ({
  verifyAnonymousToken: vi.fn(),
}));

const { broadcastRepository } = await import(
  "~/repository/broadcast-repository"
);
const broadcastService = await import("~/services/broadcast-service");
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { broadcastAdminRoutes: rawRoutes } = await import("./broadcast");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const TOKEN = "admin-token";
const adminUser = {
  id: "u-1",
  username: "admin01",
  name: "管理者",
  role: "admin" as "admin" | "staff" | "super_admin",
  passwordHash: "hash",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

const r2Bucket = {
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
  LINE_BROADCAST_BUCKET: r2Bucket,
} as unknown as CloudflareBindings;

const useAuth = (user = adminUser) => {
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token: TOKEN,
    userId: user.id,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockResolvedValue(user);
};

const authedJson = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const sampleBroadcast = {
  id: "b-1",
  title: "雪のお知らせ",
  body: "今夜は雪です",
  parts: JSON.stringify([{ type: "text", text: "今夜は雪です" }]),
  status: "draft",
  scheduledAt: null,
  sentAt: null,
  errorMessage: null,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

describe("broadcastAdminRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    r2Bucket.put.mockResolvedValue(undefined);
    r2Bucket.delete.mockResolvedValue(undefined);
  });

  describe("認可", () => {
    it("認証なしは 401", async () => {
      const res = await routes.request(
        new Request("http://localhost/", { method: "GET" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(401);
    });

    it("anonymous は 403", async () => {
      const sessionService = await import("~/services/auth/anonymous-session");
      vi.mocked(sessionService.verifyAnonymousToken).mockResolvedValue(
        "anon-uuid",
      );

      const res = await routes.request(
        new Request("http://localhost/", {
          method: "GET",
          headers: { Authorization: "Bearer some-anon-jwt" },
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(403);
    });
  });

  describe("GET /", () => {
    it("正常系: broadcasts と total を返す", async () => {
      useAuth();
      vi.mocked(broadcastRepository.findAll).mockResolvedValue({
        broadcasts: [sampleBroadcast],
        nextCursor: null,
        hasMore: false,
      });
      vi.mocked(broadcastRepository.count).mockResolvedValue(1);

      const res = await routes.request(
        authedJson("GET", "/"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { total: number; hasMore: boolean };
      expect(body.total).toBe(1);
      expect(body.hasMore).toBe(false);
    });

    it("status=draft で findAll に渡る", async () => {
      useAuth();
      vi.mocked(broadcastRepository.findAll).mockResolvedValue({
        broadcasts: [],
        nextCursor: null,
        hasMore: false,
      });
      vi.mocked(broadcastRepository.count).mockResolvedValue(0);

      await routes.request(
        authedJson("GET", "/?status=draft"),
        undefined,
        mockEnv,
      );

      expect(broadcastRepository.findAll).toHaveBeenCalledWith(mockEnv.DB, {
        limit: 30,
        cursor: undefined,
        status: "draft",
      });
    });

    it("status enum 外は 400", async () => {
      useAuth();

      const res = await routes.request(
        authedJson("GET", "/?status=unknown"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });
  });

  describe("POST /", () => {
    it("正常系: createBroadcastMessage の結果を 201 で返す", async () => {
      useAuth();
      vi.mocked(broadcastService.createBroadcastMessage).mockResolvedValue(
        sampleBroadcast,
      );

      const res = await routes.request(
        authedJson("POST", "/", {
          parts: [{ type: "text", text: "本文" }],
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(201);
      expect(broadcastService.createBroadcastMessage).toHaveBeenCalledWith(
        mockEnv,
        expect.objectContaining({
          parts: [{ type: "text", text: "本文" }],
          createdBy: "u-1",
        }),
      );
    });

    it("境界値: parts 5 件は 201", async () => {
      useAuth();
      vi.mocked(broadcastService.createBroadcastMessage).mockResolvedValue(
        sampleBroadcast,
      );

      const res = await routes.request(
        authedJson("POST", "/", {
          parts: Array.from({ length: 5 }, (_, i) => ({
            type: "text",
            text: `p${i}`,
          })),
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(201);
    });

    it("境界値: parts 6 件は 400", async () => {
      useAuth();

      const res = await routes.request(
        authedJson("POST", "/", {
          parts: Array.from({ length: 6 }, (_, i) => ({
            type: "text",
            text: `p${i}`,
          })),
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("境界値: parts 0 件は 400", async () => {
      useAuth();

      const res = await routes.request(
        authedJson("POST", "/", { parts: [] }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("service が throw すると 500 を返す", async () => {
      useAuth();
      vi.mocked(broadcastService.createBroadcastMessage).mockRejectedValue(
        new Error("DB error"),
      );

      const res = await routes.request(
        authedJson("POST", "/", {
          parts: [{ type: "text", text: "本文" }],
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(500);
    });
  });

  describe("PUT /:id", () => {
    it("draft なら更新成功", async () => {
      useAuth();
      vi.mocked(broadcastRepository.findById).mockResolvedValue(
        sampleBroadcast,
      );
      vi.mocked(broadcastService.updateBroadcastMessage).mockResolvedValue({
        ...sampleBroadcast,
        body: "更新後",
      });

      const res = await routes.request(
        authedJson("PUT", "/b-1", {
          parts: [{ type: "text", text: "更新後" }],
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("status=sent は 400 で更新を拒否", async () => {
      useAuth();
      vi.mocked(broadcastRepository.findById).mockResolvedValue({
        ...sampleBroadcast,
        status: "sent",
      });

      const res = await routes.request(
        authedJson("PUT", "/b-1", {
          parts: [{ type: "text", text: "更新後" }],
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(broadcastService.updateBroadcastMessage).not.toHaveBeenCalled();
    });

    it("存在しない id は 404", async () => {
      useAuth();
      vi.mocked(broadcastRepository.findById).mockResolvedValue(null);

      const res = await routes.request(
        authedJson("PUT", "/missing", {
          parts: [{ type: "text", text: "x" }],
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:id", () => {
    it("draft は削除可能", async () => {
      useAuth();
      vi.mocked(broadcastRepository.findById).mockResolvedValue(
        sampleBroadcast,
      );
      vi.mocked(broadcastRepository.delete).mockResolvedValue();

      const res = await routes.request(
        authedJson("DELETE", "/b-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(broadcastRepository.delete).toHaveBeenCalledWith(
        mockEnv.DB,
        "b-1",
      );
    });

    it.each([
      "sent",
      "scheduled",
    ])("status=%s は 400 で削除拒否", async (status) => {
      useAuth();
      vi.mocked(broadcastRepository.findById).mockResolvedValue({
        ...sampleBroadcast,
        status,
      });

      const res = await routes.request(
        authedJson("DELETE", "/b-1"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(broadcastRepository.delete).not.toHaveBeenCalled();
    });

    it("image part を含む broadcast 削除時に R2 オブジェクトも削除", async () => {
      useAuth();
      vi.mocked(broadcastRepository.findById).mockResolvedValue({
        ...sampleBroadcast,
        parts: JSON.stringify([
          { type: "text", text: "x" },
          { type: "image", imageR2Key: "key-1.jpg" },
          { type: "image", imageR2Key: "key-2.png" },
        ]),
      });
      vi.mocked(broadcastRepository.delete).mockResolvedValue();

      await routes.request(authedJson("DELETE", "/b-1"), undefined, mockEnv);

      expect(r2Bucket.delete).toHaveBeenCalledTimes(2);
      expect(r2Bucket.delete).toHaveBeenCalledWith("key-1.jpg");
      expect(r2Bucket.delete).toHaveBeenCalledWith("key-2.png");
    });
  });

  describe("POST /:id/send", () => {
    it("正常系: sendBroadcast 成功で 200", async () => {
      useAuth();
      vi.mocked(broadcastRepository.findById).mockResolvedValue(
        sampleBroadcast,
      );
      vi.mocked(broadcastService.sendBroadcast).mockResolvedValue({
        success: true,
      });

      const res = await routes.request(
        authedJson("POST", "/b-1/send"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it("status=sent は 400", async () => {
      useAuth();
      vi.mocked(broadcastRepository.findById).mockResolvedValue({
        ...sampleBroadcast,
        status: "sent",
      });

      const res = await routes.request(
        authedJson("POST", "/b-1/send"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(broadcastService.sendBroadcast).not.toHaveBeenCalled();
    });

    it("sendBroadcast 失敗で 500", async () => {
      useAuth();
      vi.mocked(broadcastRepository.findById).mockResolvedValue(
        sampleBroadcast,
      );
      vi.mocked(broadcastService.sendBroadcast).mockResolvedValue({
        success: false,
        error: "LINE API timeout",
      });

      const res = await routes.request(
        authedJson("POST", "/b-1/send"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(500);
    });
  });

  describe("POST /upload-image", () => {
    const buildForm = (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fd;
    };

    const uploadReq = (form: FormData) =>
      new Request("http://localhost/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: form,
      });

    it("正常系: jpeg をアップロードして imageR2Key を返す", async () => {
      useAuth();

      const file = new File([new Uint8Array([0xff, 0xd8])], "test.jpg", {
        type: "image/jpeg",
      });

      const res = await routes.request(
        uploadReq(buildForm(file)),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { imageR2Key: string };
      expect(body.imageR2Key).toMatch(/\.jpg$/);
      expect(r2Bucket.put).toHaveBeenCalledTimes(1);
    });

    it("image/gif は 400", async () => {
      useAuth();

      const file = new File([new Uint8Array([0])], "test.gif", {
        type: "image/gif",
      });

      const res = await routes.request(
        uploadReq(buildForm(file)),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(r2Bucket.put).not.toHaveBeenCalled();
    });

    it("境界値: 10MB+1 byte は 400", async () => {
      useAuth();

      const big = new Uint8Array(10 * 1024 * 1024 + 1);
      const file = new File([big], "big.jpg", { type: "image/jpeg" });

      const res = await routes.request(
        uploadReq(buildForm(file)),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("file フィールドなしは 400", async () => {
      useAuth();

      const res = await routes.request(
        uploadReq(new FormData()),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(400);
    });
  });
});

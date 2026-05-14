import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hmacSha256 } from "~/lib/crypto";
import type { Principal } from "~/lib/principal";

const mockGetThreadById = vi.fn();

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));

vi.mock("@mastra/memory", () => ({
  // biome-ignore lint/complexity/useArrowFunction: new で呼ばれる constructor mock
  Memory: vi.fn(function () {
    return {
      getThreadById: mockGetThreadById,
    };
  }),
}));

const { requireThreadAccess } = await import("./require-thread-access");

const mockThread = {
  id: "thread-123",
  resourceId: "resource-abc",
  title: "テストスレッド",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  metadata: null,
};

const mockEnv = {
  DB: {} as D1Database,
  RESOURCE_ID_HASH_SECRET: "test-secret",
} as unknown as CloudflareBindings;

const createApp = () => {
  const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { principal?: Principal; thread?: typeof mockThread };
  }>();

  // principal を手動でセットするミドルウェア
  app.use("/:threadId/*", async (c, next) => {
    const principalHeader = c.req.header("X-Test-Principal");
    if (principalHeader) {
      c.set("principal", JSON.parse(principalHeader));
    }
    await next();
  });

  app.use("/:threadId/*", requireThreadAccess);

  app.get("/:threadId/test", (c) => {
    const thread = c.get("thread");
    return c.json({ thread });
  });

  return app;
};

const makeRequest = (threadId: string, principal?: Principal) => {
  const headers: Record<string, string> = {};
  if (principal) {
    headers["X-Test-Principal"] = JSON.stringify(principal);
  }
  return new Request(`http://localhost/${threadId}/test`, { headers });
};

describe("requireThreadAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("anonymous principal + 所有スレッド → 通過して thread をセット", async () => {
    mockGetThreadById.mockResolvedValue(mockThread);
    const principal: Principal = { type: "anonymous", id: "resource-abc" };

    const res = await createApp().request(
      makeRequest("thread-123", principal),
      {},
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      thread: { id: string; resourceId: string };
    };
    expect(body.thread.id).toBe("thread-123");
    expect(body.thread.resourceId).toBe("resource-abc");
  });

  it("anonymous principal + 他人のスレッド → 404", async () => {
    mockGetThreadById.mockResolvedValue(mockThread);
    const principal: Principal = { type: "anonymous", id: "other-resource" };

    const res = await createApp().request(
      makeRequest("thread-123", principal),
      {},
      mockEnv,
    );

    expect(res.status).toBe(404);
  });

  it("admin principal + 他人のスレッド → 404", async () => {
    mockGetThreadById.mockResolvedValue(mockThread);
    const principal: Principal = {
      type: "admin",
      id: "admin-1",
      user: { id: "admin-1", username: "admin", name: null, role: "admin" },
    };

    const res = await createApp().request(
      makeRequest("thread-123", principal),
      {},
      mockEnv,
    );

    expect(res.status).toBe(404);
  });

  it("line principal + 所有スレッド（ハッシュ化された resourceId）→ 通過", async () => {
    const hashed = await hmacSha256("U123", "test-secret");
    const lineThread = { ...mockThread, resourceId: `line:${hashed}` };
    mockGetThreadById.mockResolvedValue(lineThread);
    const principal: Principal = { type: "line", id: "U123" };

    const res = await createApp().request(
      makeRequest("thread-123", principal),
      {},
      mockEnv,
    );

    expect(res.status).toBe(200);
  });

  it("line principal + 平文 resourceId のスレッド → 404（ハッシュ化前提のため）", async () => {
    const lineThread = { ...mockThread, resourceId: "line:U123" };
    mockGetThreadById.mockResolvedValue(lineThread);
    const principal: Principal = { type: "line", id: "U123" };

    const res = await createApp().request(
      makeRequest("thread-123", principal),
      {},
      mockEnv,
    );

    expect(res.status).toBe(404);
  });

  it("存在しない threadId → 404", async () => {
    mockGetThreadById.mockResolvedValue(null);
    const principal: Principal = { type: "anonymous", id: "resource-abc" };

    const res = await createApp().request(
      makeRequest("nonexistent", principal),
      {},
      mockEnv,
    );

    expect(res.status).toBe(404);
  });

  it("principal なし（未認証）→ 401", async () => {
    const res = await createApp().request(
      makeRequest("thread-123"),
      {},
      mockEnv,
    );

    expect(res.status).toBe(401);
  });
});

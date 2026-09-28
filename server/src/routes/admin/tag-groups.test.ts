import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/analytics/tag-group-assign", () => ({
  assignUnmappedTags: vi.fn(),
  createTagGroup: vi.fn(),
  getTagGroupOverview: vi.fn(),
}));

vi.mock("~/repository/persona-tag-group-repository", () => ({
  personaTagGroupRepository: { findGroup: vi.fn(), setAlias: vi.fn() },
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

const { assignUnmappedTags, createTagGroup, getTagGroupOverview } =
  await import("~/services/analytics/tag-group-assign");
const { personaTagGroupRepository } = await import(
  "~/repository/persona-tag-group-repository"
);
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { tagGroupAdminRoutes: rawRoutes } = await import("./tag-groups");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const TOKEN = "a".repeat(64);

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const useAuth = () => {
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token: TOKEN,
    userId: "u-1",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockResolvedValue({
    id: "u-1",
    username: "staff01",
    name: "職員",
    passwordHash: "hash",
    role: "staff",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: null,
  });
};

const authed = (path: string, init: RequestInit = {}) =>
  new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

describe("tagGroupAdminRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth();
  });

  it("未認証は 401", async () => {
    const res = await routes.request(
      new Request("http://localhost/"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it("GET / はグループ一覧を返す", async () => {
    vi.mocked(getTagGroupOverview).mockResolvedValue({
      groups: [],
      unassigned: [{ tag: "新語", count: 3, example: "例文" }],
      recent: [],
    });

    const res = await routes.request(authed("/"), undefined, mockEnv);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      groups: [],
      unassigned: [{ tag: "新語", count: 3, example: "例文" }],
      recent: [],
    });
  });

  it("PUT /aliases/{tag} はタグを正規化して human 割り当てを保存する", async () => {
    vi.mocked(personaTagGroupRepository.findGroup).mockResolvedValue({
      id: "tourist",
      name: "観光客",
      kind: "attribute",
      axis: "関わり",
      sortOrder: 10,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: null,
    });

    const res = await routes.request(
      authed(`/aliases/${encodeURIComponent(" 旅行者 ")}`, {
        method: "PUT",
        body: JSON.stringify({ groupId: "tourist" }),
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(personaTagGroupRepository.setAlias).toHaveBeenCalledWith(
      mockEnv.DB,
      { tag: "旅行者", groupId: "tourist", assignedBy: "human" },
    );
  });

  it("PUT /aliases/{tag} は groupId null で未分類に戻す", async () => {
    const res = await routes.request(
      authed("/aliases/%E8%AC%8E", {
        method: "PUT",
        body: JSON.stringify({ groupId: null }),
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(personaTagGroupRepository.findGroup).not.toHaveBeenCalled();
    expect(personaTagGroupRepository.setAlias).toHaveBeenCalledWith(
      mockEnv.DB,
      { tag: "謎", groupId: null, assignedBy: "human" },
    );
  });

  it("存在しないグループへの割り当ては 404", async () => {
    vi.mocked(personaTagGroupRepository.findGroup).mockResolvedValue(null);

    const res = await routes.request(
      authed("/aliases/x", {
        method: "PUT",
        body: JSON.stringify({ groupId: "nope" }),
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(404);
    expect(personaTagGroupRepository.setAlias).not.toHaveBeenCalled();
  });

  it("POST / はグループを追加して 201 を返す", async () => {
    vi.mocked(createTagGroup).mockResolvedValue({
      id: "g-1",
      name: "農家",
      kind: "attribute",
      axis: "立場",
      sortOrder: 360,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: null,
    });

    const res = await routes.request(
      authed("/", {
        method: "POST",
        body: JSON.stringify({ name: "農家", kind: "attribute", axis: "立場" }),
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: "g-1",
      name: "農家",
      kind: "attribute",
      axis: "立場",
      sortOrder: 360,
    });
  });

  it("属性グループに軸が無ければ 400", async () => {
    const res = await routes.request(
      authed("/", {
        method: "POST",
        body: JSON.stringify({ name: "農家", kind: "attribute" }),
      }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
    expect(createTagGroup).not.toHaveBeenCalled();
  });

  it("POST /assign は 1 バッチ分の結果を返す", async () => {
    vi.mocked(assignUnmappedTags).mockResolvedValue({
      assigned: 80,
      unassigned: 20,
      remaining: 300,
    });

    const res = await routes.request(
      authed("/assign", { method: "POST" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      assigned: 80,
      unassigned: 20,
      remaining: 300,
    });
  });
});

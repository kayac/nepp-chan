import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/knowledge-source-repository", () => ({
  APPROVAL_STATUSES: ["pending", "approved", "rejected", "disabled"],
  knowledgeSourceRepository: {
    findByPath: vi.fn(),
    list: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("~/services/knowledge/indexing", () => ({
  indexKnowledgeSource: vi.fn(),
  removeKnowledgeSource: vi.fn(),
}));

vi.mock("~/services/knowledge/sync", () => ({
  listMarkdownObjects: vi.fn(),
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

const { knowledgeSourceRepository } = await import(
  "~/repository/knowledge-source-repository"
);
const { indexKnowledgeSource, removeKnowledgeSource } = await import(
  "~/services/knowledge/indexing"
);
const { listMarkdownObjects } = await import("~/services/knowledge/sync");
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { knowledgeAdminRoutes } = await import(".");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const app = await withResolvePrincipal(knowledgeAdminRoutes);

const testUser = {
  id: "user-1",
  username: "admin01",
  name: "管理者",
  role: "super_admin",
  passwordHash: "100000:salt:hash",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: null,
};

const r2Bucket = { get: vi.fn(), list: vi.fn() };

const mockEnv = {
  DB: {} as D1Database,
  KNOWLEDGE_BUCKET: r2Bucket as unknown as R2Bucket,
  VECTORIZE: {} as VectorizeIndex,
  GOOGLE_GENERATIVE_AI_API_KEY: "test-api-key",
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const VALID_OPAQUE_TOKEN = "a".repeat(64);

const authedRequest = (path: string, init?: RequestInit) => {
  const req = new Request(`http://localhost${path}`, init);
  req.headers.set("Authorization", `Bearer ${VALID_OPAQUE_TOKEN}`);
  return req;
};

const baseRow = {
  sourcePath: "bus/index.md",
  canonicalUrl: "https://example.com/bus",
  sourceType: null,
  sourceAuthority: null,
  sourceHash: "hash-1",
  r2Etag: "etag-1",
  chunkCount: 5,
  approvalStatus: "pending",
  approvedBy: null,
  approvedAt: null,
  disabledAt: null,
  verifiedAt: null,
  indexedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token: VALID_OPAQUE_TOKEN,
    userId: "user-1",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2024-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockResolvedValue(testUser);
});

describe("GET /sources", () => {
  it("認証なしは 401", async () => {
    const res = await app.request(
      new Request("http://localhost/sources"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it("情報源一覧を返す", async () => {
    vi.mocked(knowledgeSourceRepository.list).mockResolvedValue([baseRow]);

    const res = await app.request(
      authedRequest("/sources"),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sources: unknown[] };
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0]).toMatchObject({
      sourcePath: "bus/index.md",
      approvalStatus: "pending",
      chunkCount: 5,
    });
  });
});

describe("POST /sources/backfill", () => {
  it("未登録の情報源だけを approved で登録する", async () => {
    vi.mocked(listMarkdownObjects).mockResolvedValue({
      allObjects: [],
      mdFiles: [
        { key: "a.md", etag: "e-a" },
        { key: "b.md", etag: "e-b" },
      ] as R2Object[],
    });
    vi.mocked(knowledgeSourceRepository.list).mockResolvedValue([
      { ...baseRow, sourcePath: "a.md" },
    ]);
    r2Bucket.get.mockResolvedValue({
      text: async () => "---\nurl: 'https://example.com/b'\n---\n本文",
    });

    const res = await app.request(
      authedRequest("/sources/backfill", { method: "POST" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { registered: number; skipped: number };
    expect(body).toMatchObject({ registered: 1, skipped: 1 });
    expect(knowledgeSourceRepository.insert).toHaveBeenCalledTimes(1);
    expect(knowledgeSourceRepository.insert).toHaveBeenCalledWith(
      mockEnv.DB,
      expect.objectContaining({
        sourcePath: "b.md",
        canonicalUrl: "https://example.com/b",
        approvalStatus: "approved",
        approvedBy: "user-1",
        r2Etag: "e-b",
      }),
    );
  });
});

describe("PATCH /sources/status", () => {
  const patchBody = (data: Record<string, unknown>): RequestInit => ({
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  it("未登録の source_path は 404", async () => {
    vi.mocked(knowledgeSourceRepository.findByPath).mockResolvedValue(null);

    const res = await app.request(
      authedRequest(
        "/sources/status",
        patchBody({ sourcePath: "missing.md", action: "approve" }),
      ),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(404);
  });

  it("approve は R2 にファイルが無ければ 404", async () => {
    vi.mocked(knowledgeSourceRepository.findByPath).mockResolvedValue(baseRow);
    r2Bucket.get.mockResolvedValue(null);

    const res = await app.request(
      authedRequest(
        "/sources/status",
        patchBody({ sourcePath: "bus/index.md", action: "approve" }),
      ),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(404);
  });

  it("approve は承認情報を記録して再インデックスする", async () => {
    vi.mocked(knowledgeSourceRepository.findByPath)
      .mockResolvedValueOnce(baseRow)
      .mockResolvedValueOnce({
        ...baseRow,
        approvalStatus: "approved",
        approvedBy: "user-1",
      });
    r2Bucket.get.mockResolvedValue({ text: async () => "# 本文" });
    vi.mocked(indexKnowledgeSource).mockResolvedValue({
      indexed: true,
      status: "approved",
      chunks: 4,
    });

    const res = await app.request(
      authedRequest(
        "/sources/status",
        patchBody({ sourcePath: "bus/index.md", action: "approve" }),
      ),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(knowledgeSourceRepository.update).toHaveBeenCalledWith(
      mockEnv.DB,
      "bus/index.md",
      expect.objectContaining({
        approvalStatus: "approved",
        approvedBy: "user-1",
        disabledAt: null,
      }),
    );
    expect(indexKnowledgeSource).toHaveBeenCalledWith(
      "bus/index.md",
      "# 本文",
      {
        d1: mockEnv.DB,
        vectorize: mockEnv.VECTORIZE,
        apiKey: "test-api-key",
      },
    );
  });

  it("approve でインデックスが失敗したら 500", async () => {
    vi.mocked(knowledgeSourceRepository.findByPath).mockResolvedValue(baseRow);
    r2Bucket.get.mockResolvedValue({ text: async () => "# 本文" });
    vi.mocked(indexKnowledgeSource).mockResolvedValue({
      indexed: true,
      status: "approved",
      chunks: 0,
      error: "embed failed",
    });

    const res = await app.request(
      authedRequest(
        "/sources/status",
        patchBody({ sourcePath: "bus/index.md", action: "approve" }),
      ),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(500);
  });

  it.each([
    ["reject", "rejected"],
    ["disable", "disabled"],
  ] as const)("%s は検索対象からも削除する", async (action, status) => {
    vi.mocked(knowledgeSourceRepository.findByPath)
      .mockResolvedValueOnce({ ...baseRow, approvalStatus: "approved" })
      .mockResolvedValueOnce({ ...baseRow, approvalStatus: status });
    vi.mocked(removeKnowledgeSource).mockResolvedValue({ deleted: 5 });

    const res = await app.request(
      authedRequest(
        "/sources/status",
        patchBody({ sourcePath: "bus/index.md", action }),
      ),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(knowledgeSourceRepository.update).toHaveBeenCalledWith(
      mockEnv.DB,
      "bus/index.md",
      expect.objectContaining({ approvalStatus: status }),
    );
    expect(removeKnowledgeSource).toHaveBeenCalledWith("bus/index.md", {
      d1: mockEnv.DB,
      vectorize: mockEnv.VECTORIZE,
    });
  });

  it("disable は disabledAt を記録する", async () => {
    vi.mocked(knowledgeSourceRepository.findByPath)
      .mockResolvedValueOnce({ ...baseRow, approvalStatus: "approved" })
      .mockResolvedValueOnce({ ...baseRow, approvalStatus: "disabled" });
    vi.mocked(removeKnowledgeSource).mockResolvedValue({ deleted: 5 });

    await app.request(
      authedRequest(
        "/sources/status",
        patchBody({ sourcePath: "bus/index.md", action: "disable" }),
      ),
      undefined,
      mockEnv,
    );

    const input = vi.mocked(knowledgeSourceRepository.update).mock.calls[0][2];
    expect(input.disabledAt).toEqual(expect.any(String));
  });
});

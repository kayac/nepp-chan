import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/knowledge-correction-repository", () => ({
  NEEDS_REVIEW_REASONS: ["source_updated", "source_unavailable"] as const,
  knowledgeCorrectionRepository: {
    findById: vi.fn(),
    list: vi.fn(),
    listPublished: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("~/repository/knowledge-source-repository", () => ({
  knowledgeSourceRepository: { findByPath: vi.fn() },
}));

vi.mock("~/services/knowledge/corrections", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/services/knowledge/corrections")>();
  return {
    ...actual,
    publishCorrection: vi.fn(),
  };
});

vi.mock("~/services/knowledge/indexing", () => ({
  removeKnowledgeSource: vi.fn(),
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

const { knowledgeCorrectionRepository } = await import(
  "~/repository/knowledge-correction-repository"
);
const { knowledgeSourceRepository } = await import(
  "~/repository/knowledge-source-repository"
);
const { publishCorrection } = await import("~/services/knowledge/corrections");
const { removeKnowledgeSource } = await import("~/services/knowledge/indexing");
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { correctionsAdminRoutes } = await import("./corrections");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const app = await withResolvePrincipal(correctionsAdminRoutes);

const testUser = {
  id: "user-1",
  username: "admin01",
  name: "管理者",
  role: "admin",
  passwordHash: "100000:salt:hash",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: null,
};

const r2Bucket = { put: vi.fn(), delete: vi.fn() };

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

const jsonBody = (data: Record<string, unknown>): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

const correction = {
  id: "cor-1",
  correctsSourcePath: "bus/index.md",
  body: "土曜は運休です",
  status: "published",
  verifiedAt: "2026-09-01",
  approvedBy: "user-1",
  relatedFeedbackId: null,
  answerRunId: null,
  needsReviewAt: null,
  needsReviewReason: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: null,
};

const sourceRow = {
  sourcePath: "bus/index.md",
  canonicalUrl: "https://example.com/bus",
  sourceType: null,
  sourceAuthority: null,
  sourceHash: "h",
  r2Etag: null,
  chunkCount: 5,
  approvalStatus: "approved",
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
  vi.mocked(publishCorrection).mockResolvedValue({
    indexed: true,
    status: "approved",
    chunks: 1,
  });
});

describe("POST /", () => {
  it("認証なしは 401", async () => {
    const res = await app.request(
      new Request("http://localhost/", jsonBody({})),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it("訂正対象の情報源が無ければ 404", async () => {
    vi.mocked(knowledgeSourceRepository.findByPath).mockResolvedValue(null);

    const res = await app.request(
      authedRequest(
        "/",
        jsonBody({ correctsSourcePath: "missing.md", body: "訂正" }),
      ),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(404);
  });

  it("情報源が検索対象から外れていたら 400", async () => {
    vi.mocked(knowledgeSourceRepository.findByPath).mockResolvedValue({
      ...sourceRow,
      approvalStatus: "disabled",
    });

    const res = await app.request(
      authedRequest(
        "/",
        jsonBody({ correctsSourcePath: "bus/index.md", body: "訂正" }),
      ),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(400);
    expect(knowledgeCorrectionRepository.insert).not.toHaveBeenCalled();
  });

  it("draft で保存し、発行成功後に published へ更新する", async () => {
    vi.mocked(knowledgeSourceRepository.findByPath).mockResolvedValue(
      sourceRow,
    );
    vi.mocked(knowledgeCorrectionRepository.insert).mockResolvedValue({
      ...correction,
      status: "draft",
    });
    vi.mocked(knowledgeCorrectionRepository.update).mockResolvedValue(
      correction,
    );

    const res = await app.request(
      authedRequest(
        "/",
        jsonBody({
          correctsSourcePath: "bus/index.md",
          body: "土曜は運休です",
          answerRunId: "ar-1",
        }),
      ),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(knowledgeCorrectionRepository.insert).toHaveBeenCalledWith(
      mockEnv.DB,
      expect.objectContaining({
        correctsSourcePath: "bus/index.md",
        body: "土曜は運休です",
        status: "draft",
        approvedBy: "user-1",
        answerRunId: "ar-1",
      }),
    );
    expect(publishCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ d1: mockEnv.DB }),
      expect.objectContaining({ status: "draft" }),
      { canonicalUrl: "https://example.com/bus" },
    );
    expect(knowledgeCorrectionRepository.update).toHaveBeenCalledWith(
      mockEnv.DB,
      "cor-1",
      { status: "published" },
    );
  });

  it("発行に失敗したら 500 を返す", async () => {
    vi.mocked(knowledgeSourceRepository.findByPath).mockResolvedValue(
      sourceRow,
    );
    vi.mocked(knowledgeCorrectionRepository.insert).mockResolvedValue({
      ...correction,
      status: "draft",
    });
    vi.mocked(publishCorrection).mockResolvedValue({
      indexed: true,
      status: "approved",
      chunks: 0,
      error: "embed failed",
    });

    const res = await app.request(
      authedRequest(
        "/",
        jsonBody({ correctsSourcePath: "bus/index.md", body: "訂正" }),
      ),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(500);
    expect(knowledgeCorrectionRepository.update).not.toHaveBeenCalled();
  });
});

describe("GET /", () => {
  it("訂正一覧を返す", async () => {
    vi.mocked(knowledgeCorrectionRepository.list).mockResolvedValue([
      correction,
    ]);

    const res = await app.request(authedRequest("/"), undefined, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { corrections: unknown[] };
    expect(body.corrections).toHaveLength(1);
  });
});

describe("POST /{id}/retire", () => {
  it("訂正が無ければ 404", async () => {
    vi.mocked(knowledgeCorrectionRepository.findById).mockResolvedValue(null);

    const res = await app.request(
      authedRequest("/cor-x/retire", { method: "POST" }),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(404);
  });

  it("retired にして R2 と Vectorize から削除する", async () => {
    vi.mocked(knowledgeCorrectionRepository.findById).mockResolvedValue(
      correction,
    );
    vi.mocked(knowledgeCorrectionRepository.update).mockResolvedValue({
      ...correction,
      status: "retired",
    });

    const res = await app.request(
      authedRequest("/cor-1/retire", { method: "POST" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(knowledgeCorrectionRepository.update).toHaveBeenCalledWith(
      mockEnv.DB,
      "cor-1",
      { status: "retired", needsReviewAt: null, needsReviewReason: null },
    );
    expect(r2Bucket.delete).toHaveBeenCalledWith(
      "curated/corrections/cor-1.md",
    );
    expect(removeKnowledgeSource).toHaveBeenCalledWith(
      "curated/corrections/cor-1.md",
      { d1: mockEnv.DB, vectorize: mockEnv.VECTORIZE },
    );
  });
});

describe("POST /{id}/publish", () => {
  it("retired の訂正は 404", async () => {
    vi.mocked(knowledgeCorrectionRepository.findById).mockResolvedValue({
      ...correction,
      status: "retired",
    });

    const res = await app.request(
      authedRequest("/cor-1/publish", { method: "POST" }),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(404);
  });

  it("draft を再発行して published にする", async () => {
    vi.mocked(knowledgeCorrectionRepository.findById).mockResolvedValue({
      ...correction,
      status: "draft",
    });
    vi.mocked(knowledgeCorrectionRepository.update).mockResolvedValue(
      correction,
    );

    const res = await app.request(
      authedRequest("/cor-1/publish", { method: "POST" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(publishCorrection).toHaveBeenCalled();
    expect(knowledgeCorrectionRepository.update).toHaveBeenCalledWith(
      mockEnv.DB,
      "cor-1",
      { status: "published" },
    );
  });

  it("発行に失敗したら published にしない", async () => {
    vi.mocked(knowledgeCorrectionRepository.findById).mockResolvedValue({
      ...correction,
      status: "draft",
    });
    vi.mocked(publishCorrection).mockResolvedValue({
      indexed: true,
      status: "approved",
      chunks: 0,
      error: "embed failed",
    });

    const res = await app.request(
      authedRequest("/cor-1/publish", { method: "POST" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(500);
    expect(knowledgeCorrectionRepository.update).not.toHaveBeenCalled();
  });
});

describe("POST /{id}/reverify", () => {
  it("retired の訂正は 404", async () => {
    vi.mocked(knowledgeCorrectionRepository.findById).mockResolvedValue({
      ...correction,
      status: "retired",
    });

    const res = await app.request(
      authedRequest("/cor-1/reverify", { method: "POST" }),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(404);
  });

  it("確認日を更新しフラグを消して再発行する", async () => {
    vi.mocked(knowledgeCorrectionRepository.findById).mockResolvedValue({
      ...correction,
      needsReviewAt: "2026-09-02T00:00:00.000Z",
    });
    vi.mocked(knowledgeCorrectionRepository.update).mockResolvedValue(
      correction,
    );
    vi.mocked(knowledgeSourceRepository.findByPath).mockResolvedValue(
      sourceRow,
    );

    const res = await app.request(
      authedRequest("/cor-1/reverify", { method: "POST" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(publishCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ d1: mockEnv.DB }),
      expect.objectContaining({ approvedBy: "user-1" }),
      expect.anything(),
    );
    expect(knowledgeCorrectionRepository.update).toHaveBeenCalledWith(
      mockEnv.DB,
      "cor-1",
      expect.objectContaining({
        needsReviewAt: null,
        approvedBy: "user-1",
        verifiedAt: expect.any(String),
      }),
    );
  });
});

describe("POST /republish", () => {
  it("公開中の訂正を全件再発行する", async () => {
    vi.mocked(knowledgeCorrectionRepository.listPublished).mockResolvedValue([
      correction,
      { ...correction, id: "cor-2" },
    ]);
    vi.mocked(knowledgeSourceRepository.findByPath).mockResolvedValue(
      sourceRow,
    );

    const res = await app.request(
      authedRequest("/republish", { method: "POST" }),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { published: number };
    expect(body.published).toBe(2);
    expect(publishCorrection).toHaveBeenCalledTimes(2);
  });
});

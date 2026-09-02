import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/source-candidate-repository", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("~/repository/source-candidate-repository")
    >();
  return {
    ...actual,
    sourceCandidateRepository: {
      list: vi.fn(),
      findById: vi.fn(),
      updateStatus: vi.fn(),
    },
  };
});

vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: { findValid: vi.fn() },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: { findById: vi.fn() },
}));

vi.mock("~/services/auth/anonymous-session", () => ({
  verifyAnonymousToken: vi.fn(),
}));

const { sourceCandidateRepository } = await import(
  "~/repository/source-candidate-repository"
);
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { sourceCandidatesAdminRoutes } = await import("./source-candidates");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const app = await withResolvePrincipal(sourceCandidatesAdminRoutes);

const testUser = {
  id: "user-1",
  username: "admin01",
  name: "管理者",
  role: "admin",
  passwordHash: "100000:salt:hash",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: null,
};

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const VALID_OPAQUE_TOKEN = "a".repeat(64);

const authedRequest = (path: string, init?: RequestInit) => {
  const req = new Request(`http://localhost${path}`, init);
  req.headers.set("Authorization", `Bearer ${VALID_OPAQUE_TOKEN}`);
  return req;
};

const candidate = {
  id: "cand-1",
  url: "https://vill.example.jp/garbage",
  status: "pending",
  occurrenceCount: 3,
  relatedAnswerRunId: "ar-1",
  decidedBy: null,
  decidedAt: null,
  lastSeenAt: "2026-09-01T00:00:00.000Z",
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

describe("GET /", () => {
  it("認証なしは 401", async () => {
    const res = await app.request(
      new Request("http://localhost/"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it("候補一覧を返す", async () => {
    vi.mocked(sourceCandidateRepository.list).mockResolvedValue([candidate]);

    const res = await app.request(authedRequest("/"), undefined, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { candidates: unknown[] };
    expect(body.candidates[0]).toMatchObject({
      url: "https://vill.example.jp/garbage",
      occurrenceCount: 3,
    });
  });
});

describe("PATCH /{id}/status", () => {
  const patchBody = (action: string): RequestInit => ({
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });

  it("候補が無ければ 404", async () => {
    vi.mocked(sourceCandidateRepository.findById).mockResolvedValue(null);

    const res = await app.request(
      authedRequest("/missing/status", patchBody("approve")),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(404);
  });

  it.each([
    ["approve", "approved"],
    ["reject", "rejected"],
  ] as const)("%s で %s に更新する", async (action, status) => {
    vi.mocked(sourceCandidateRepository.findById).mockResolvedValue(candidate);
    vi.mocked(sourceCandidateRepository.updateStatus).mockResolvedValue({
      ...candidate,
      status,
      decidedBy: "user-1",
    });

    const res = await app.request(
      authedRequest("/cand-1/status", patchBody(action)),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(sourceCandidateRepository.updateStatus).toHaveBeenCalledWith(
      mockEnv.DB,
      "cand-1",
      { status, decidedBy: "user-1" },
    );
  });

  it("reset で未判断に戻し、判断者を消す", async () => {
    vi.mocked(sourceCandidateRepository.findById).mockResolvedValue({
      ...candidate,
      status: "approved",
      decidedBy: "user-1",
      decidedAt: "2026-09-01T00:00:00.000Z",
    });
    vi.mocked(sourceCandidateRepository.updateStatus).mockResolvedValue(
      candidate,
    );

    const res = await app.request(
      authedRequest("/cand-1/status", patchBody("reset")),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(sourceCandidateRepository.updateStatus).toHaveBeenCalledWith(
      mockEnv.DB,
      "cand-1",
      { status: "pending", decidedBy: null },
    );
  });
});

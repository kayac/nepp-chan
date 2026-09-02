import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/review-repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/repository/review-repository")>();
  return {
    ...actual,
    reviewRepository: {
      listQueue: vi.fn(),
      listRunsByAnswerRunId: vi.fn(),
      hasWebFallback: vi.fn(),
      findBadFeedbackByMessageId: vi.fn(),
      listDecisions: vi.fn(),
      insertDecision: vi.fn(),
      deleteDecision: vi.fn(),
    },
  };
});

vi.mock("~/repository/feedback-repository", () => ({
  feedbackRepository: { resolve: vi.fn(), unresolve: vi.fn() },
}));

vi.mock("~/services/review", () => ({
  getAnswerConversation: vi.fn(),
}));

vi.mock("~/services/review-evidence", () => ({
  buildDecisionEvidence: vi.fn(),
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

const { reviewRepository } = await import("~/repository/review-repository");
const { feedbackRepository } = await import("~/repository/feedback-repository");
const { getAnswerConversation } = await import("~/services/review");
const { buildDecisionEvidence } = await import("~/services/review-evidence");
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { reviewAdminRoutes } = await import("./review");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const app = await withResolvePrincipal(reviewAdminRoutes);

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

const queueRow = {
  answerRunId: "ar-1",
  threadId: "thread-1",
  messageId: "msg-1",
  turnIndex: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  searchCount: 2,
  totalHits: 0,
  queries: '["q1","q2"]',
  webFallback: 1,
  feedbackId: "fb-1",
  decision: null,
  decidedAt: null,
};

const run = (over: Record<string, unknown> = {}) => ({
  id: "run-1",
  answerRunId: "ar-1",
  threadId: "thread-1",
  messageId: "msg-1",
  turnIndex: 1,
  query: "q1",
  hits: '[{"source":"a.md","score":0.9}]',
  durationMs: 100,
  createdAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

const decisionRow = (over: Record<string, unknown> = {}) => ({
  id: "dec-1",
  answerRunId: "ar-1",
  threadId: "thread-1",
  feedbackId: null,
  decision: "no_issue",
  comment: null,
  evidence: null,
  reviewedBy: "user-1",
  createdAt: "2026-09-02T00:00:00.000Z",
  ...over,
});

const badFeedback = {
  id: "fb-1",
  threadId: "thread-1",
  messageId: "msg-1",
  rating: "bad",
  category: null,
  comment: "違うよ",
  conversationContext: "{}",
  toolExecutions: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  resolvedAt: null,
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

  it("要確認一覧をフラグ付きで返す", async () => {
    vi.mocked(reviewRepository.listQueue).mockResolvedValue({
      items: [queueRow],
      hasMore: false,
      nextCursor: null,
    });

    const res = await app.request(authedRequest("/"), undefined, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items[0]).toMatchObject({
      answerRunId: "ar-1",
      queries: ["q1", "q2"],
      flags: { zeroHit: true, webFallback: true, badFeedback: true },
    });
  });

  it("decided クエリを boolean に変換して渡す", async () => {
    vi.mocked(reviewRepository.listQueue).mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: null,
    });

    await app.request(authedRequest("/?decided=false"), undefined, mockEnv);

    expect(reviewRepository.listQueue).toHaveBeenCalledWith(mockEnv.DB, {
      limit: 30,
      cursor: undefined,
      decided: false,
    });
  });
});

describe("GET /{answerRunId}", () => {
  it("runs も判断履歴も無ければ 404", async () => {
    vi.mocked(reviewRepository.listRunsByAnswerRunId).mockResolvedValue([]);
    vi.mocked(reviewRepository.listDecisions).mockResolvedValue([]);

    const res = await app.request(
      authedRequest("/ar-missing"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(404);
  });

  it("runs が保管期限で消えても判断履歴とスナップショットを返す", async () => {
    vi.mocked(reviewRepository.listRunsByAnswerRunId).mockResolvedValue([]);
    vi.mocked(reviewRepository.listDecisions).mockResolvedValue([
      decisionRow({
        evidence: JSON.stringify({
          question: "[NAME]さんの家の水道",
          answer: "窓口に連絡してね",
          runs: [{ query: "水道 故障", sources: ["water.md"] }],
        }),
      }),
    ]);

    const res = await app.request(authedRequest("/ar-1"), undefined, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      runs: [],
      conversation: null,
      archivedEvidence: { question: "[NAME]さんの家の水道" },
    });
    expect((body.decisions as unknown[]).length).toBe(1);
  });

  it("詳細（根拠・会話・評価・判断履歴）を返す", async () => {
    vi.mocked(reviewRepository.listRunsByAnswerRunId).mockResolvedValue([
      run(),
      run({ id: "run-2", query: "q2", hits: "[]" }),
    ]);
    vi.mocked(reviewRepository.hasWebFallback).mockResolvedValue(true);
    vi.mocked(reviewRepository.findBadFeedbackByMessageId).mockResolvedValue([
      badFeedback,
    ]);
    vi.mocked(reviewRepository.listDecisions).mockResolvedValue([]);
    vi.mocked(getAnswerConversation).mockResolvedValue({
      question: "バスの時刻は？",
      answer: "8時だよ",
    });

    const res = await app.request(authedRequest("/ar-1"), undefined, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      answerRunId: "ar-1",
      flags: { zeroHit: false, webFallback: true, badFeedback: true },
      conversation: { question: "バスの時刻は？", answer: "8時だよ" },
    });
    expect((body.runs as unknown[]).length).toBe(2);
    expect((body.feedbacks as unknown[]).length).toBe(1);
  });
});

describe("POST /{answerRunId}/decision", () => {
  const postBody = (data: Record<string, unknown>): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  it("runs が無ければ 404", async () => {
    vi.mocked(reviewRepository.listRunsByAnswerRunId).mockResolvedValue([]);

    const res = await app.request(
      authedRequest("/ar-missing/decision", postBody({ decision: "no_issue" })),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(404);
  });

  it("不正な decision は 400", async () => {
    const res = await app.request(
      authedRequest("/ar-1/decision", postBody({ decision: "invalid" })),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(400);
  });

  it("判断を記録し bad feedback を解決済みにする", async () => {
    vi.mocked(reviewRepository.listRunsByAnswerRunId).mockResolvedValue([
      run(),
    ]);
    vi.mocked(reviewRepository.findBadFeedbackByMessageId).mockResolvedValue([
      badFeedback,
    ]);
    vi.mocked(reviewRepository.insertDecision).mockImplementation(
      async (_d1, values) => values as never,
    );
    vi.mocked(buildDecisionEvidence).mockResolvedValue({
      question: "バスの時刻は？",
      answer: "8時だよ",
      runs: [{ query: "q1", sources: ["a.md"] }],
    });

    const res = await app.request(
      authedRequest(
        "/ar-1/decision",
        postBody({ decision: "incorrect", comment: "時刻が古い" }),
      ),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(reviewRepository.insertDecision).toHaveBeenCalledWith(
      mockEnv.DB,
      expect.objectContaining({
        answerRunId: "ar-1",
        feedbackId: "fb-1",
        decision: "incorrect",
        comment: "時刻が古い",
        reviewedBy: "user-1",
        threadId: "thread-1",
        evidence: JSON.stringify({
          question: "バスの時刻は？",
          answer: "8時だよ",
          runs: [{ query: "q1", sources: ["a.md"] }],
        }),
      }),
    );
    expect(feedbackRepository.resolve).toHaveBeenCalledWith(mockEnv.DB, "fb-1");
  });

  it("解決済み feedback は再 resolve しない", async () => {
    vi.mocked(reviewRepository.listRunsByAnswerRunId).mockResolvedValue([
      run(),
    ]);
    vi.mocked(buildDecisionEvidence).mockResolvedValue({
      question: null,
      answer: null,
      runs: [],
    });
    vi.mocked(reviewRepository.findBadFeedbackByMessageId).mockResolvedValue([
      { ...badFeedback, resolvedAt: "2026-09-01T01:00:00.000Z" },
    ]);
    vi.mocked(reviewRepository.insertDecision).mockImplementation(
      async (_d1, values) => values as never,
    );

    const res = await app.request(
      authedRequest("/ar-1/decision", postBody({ decision: "no_issue" })),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(feedbackRepository.resolve).not.toHaveBeenCalled();
  });
});

describe("DELETE /{answerRunId}/decision", () => {
  const del: RequestInit = { method: "DELETE" };

  it("判断が無ければ 404", async () => {
    vi.mocked(reviewRepository.listDecisions).mockResolvedValue([]);

    const res = await app.request(
      authedRequest("/ar-1/decision", del),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(404);
  });

  it("直近の判断を削除し、bad 評価の解決済みを取り消す", async () => {
    vi.mocked(reviewRepository.listDecisions).mockResolvedValue([
      decisionRow({ id: "dec-2", feedbackId: "fb-1" }),
    ]);

    const res = await app.request(
      authedRequest("/ar-1/decision", del),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ undecided: true });
    expect(reviewRepository.deleteDecision).toHaveBeenCalledWith(
      mockEnv.DB,
      "dec-2",
    );
    expect(feedbackRepository.unresolve).toHaveBeenCalledWith(
      mockEnv.DB,
      "fb-1",
    );
  });

  it("前の判断が同じ bad 評価を参照していれば解決済みは維持する", async () => {
    vi.mocked(reviewRepository.listDecisions).mockResolvedValue([
      decisionRow({ id: "dec-2", feedbackId: "fb-1" }),
      decisionRow({ id: "dec-1", feedbackId: "fb-1" }),
    ]);

    const res = await app.request(
      authedRequest("/ar-1/decision", del),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ undecided: false });
    expect(feedbackRepository.unresolve).not.toHaveBeenCalled();
  });
});

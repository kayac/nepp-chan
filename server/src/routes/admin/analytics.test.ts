import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/analytics/aggregate", () => ({
  getConversationStats: vi.fn(),
  getWeeklyUsage: vi.fn(),
  getThreadUsage: vi.fn(),
  getThreadTurnUsage: vi.fn(),
  getOperationCost: vi.fn(),
  getPersonaAnalytics: vi.fn(),
}));

vi.mock("~/repository/weekly-report-repository", () => ({
  weeklyReportRepository: {
    list: vi.fn(),
    findById: vi.fn(),
  },
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

vi.mock("~/services/analytics/ontology", () => ({
  getOntology: vi.fn(),
}));

const {
  getConversationStats,
  getWeeklyUsage,
  getThreadUsage,
  getThreadTurnUsage,
  getOperationCost,
  getPersonaAnalytics,
} = await import("~/services/analytics/aggregate");
const { getOntology } = await import("~/services/analytics/ontology");
const { weeklyReportRepository } = await import(
  "~/repository/weekly-report-repository"
);
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { analyticsAdminRoutes: rawRoutes } = await import("./analytics");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const TOKEN = "a".repeat(64);

const baseUser = {
  id: "u-1",
  username: "admin01",
  name: "管理者",
  passwordHash: "hash",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const useAuth = (role: "super_admin" | "admin" | "staff") => {
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token: TOKEN,
    userId: baseUser.id,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockResolvedValue({
    ...baseUser,
    role,
  });
};

const authedGet = (path: string) =>
  new Request(`http://localhost${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

const emptyConversationStats = {
  daily: [],
  hourly: [],
  weekday: [],
  platforms: [],
  totals: { conversations: 0, messages: 0 },
};

const emptyPersonaAnalytics = {
  totalCount: 0,
  hourly: [],
  weekday: [],
  officeHours: { open: 0, closed: 0 },
  ageSentiment: [],
  topics: [],
  segments: { residence: [], relationship: [] },
};

describe("analyticsAdminRoutes: 認可", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPersonaAnalytics).mockResolvedValue(emptyPersonaAnalytics);
  });

  it("未認証は 401", async () => {
    const res = await routes.request(
      new Request("http://localhost/persona"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it.each(["/persona", "/ontology", "/conversations", "/reports"])(
    "staff でも分析系（%s）は 200",
    async (path) => {
      useAuth("staff");
      vi.mocked(getOntology).mockResolvedValue({
        nodes: [],
        links: [],
        meta: {
          personaTotal: 0,
          generatedAt: "2026-06-09T00:00:00.000Z",
          entityLayerStatus: "none",
          note: "",
        },
      });
      vi.mocked(getConversationStats).mockResolvedValue({
        daily: [],
        hourly: [],
        weekday: [],
        platforms: [],
        totals: { conversations: 0, messages: 0 },
      });
      vi.mocked(weeklyReportRepository.list).mockResolvedValue([]);

      const res = await routes.request(authedGet(path), undefined, mockEnv);
      expect(res.status).toBe(200);
    },
  );

  it("super_admin は 200", async () => {
    useAuth("super_admin");
    const res = await routes.request(authedGet("/persona"), undefined, mockEnv);
    expect(res.status).toBe(200);
  });

  it("利用コストは staff / admin では見られない（super_admin 専用）", async () => {
    useAuth("staff");
    const staffRes = await routes.request(
      authedGet("/usage"),
      undefined,
      mockEnv,
    );
    expect(staffRes.status).toBe(403);

    useAuth("admin");
    const adminRes = await routes.request(
      authedGet("/usage"),
      undefined,
      mockEnv,
    );
    expect(adminRes.status).toBe(403);
  });

  it("会話単位の利用コストも super_admin 専用", async () => {
    useAuth("admin");
    const res = await routes.request(
      authedGet("/usage/threads"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /usage/threads", () => {
  const emptyThreadUsage = {
    summary: {
      threads: 0,
      messages: 0,
      conversationCostUsd: 0,
      avgCostPerMessageUsd: null,
      avgCostPerThreadUsd: null,
      byAgent: [],
    },
    threads: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth("super_admin");
    vi.mocked(getThreadUsage).mockResolvedValue(emptyThreadUsage);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T02:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("days 日分を JST 日初め起点で集計し limit を渡す", async () => {
    const res = await routes.request(
      authedGet("/usage/threads?days=7&limit=10"),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    // JST 06-10 の 7 日前 = JST 06-04 00:00（UTC 06-03 15:00）
    expect(getThreadUsage).toHaveBeenCalledWith(
      mockEnv.DB,
      {
        from: "2026-06-03T15:00:00.000Z",
        to: "2026-06-10T02:00:00.000Z",
      },
      { limit: 10 },
    );
    expect(await res.json()).toEqual(emptyThreadUsage);
  });

  it("days は 30 を超えると 400", async () => {
    const res = await routes.request(
      authedGet("/usage/threads?days=31"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /usage/operation", () => {
  const operationCost = {
    totalCostUsd: 0.11,
    byCategory: [
      { category: "conversation", costUsd: 0.07, agents: [] },
      { category: "knowledge-base", costUsd: 0.04, agents: [] },
    ],
    byProvider: [{ provider: "openai", totalTokens: 100, costUsd: 0.11 }],
    daily: [{ date: "2026-06-09", costUsd: 0.11 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperationCost).mockResolvedValue(operationCost);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T02:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("super_admin は用途別・プロバイダ別の内訳を取得できる", async () => {
    useAuth("super_admin");
    const res = await routes.request(
      authedGet("/usage/operation?days=7"),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(getOperationCost).toHaveBeenCalledWith(mockEnv.DB, {
      from: "2026-06-03T15:00:00.000Z",
      to: "2026-06-10T02:00:00.000Z",
    });
    expect(await res.json()).toEqual(operationCost);
  });

  it("admin は 403", async () => {
    useAuth("admin");
    const res = await routes.request(
      authedGet("/usage/operation"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /usage/threads/{threadId}", () => {
  const turnUsage = {
    turns: [
      {
        turnIndex: 1,
        answeredAt: "2026-06-09T00:00:00.000Z",
        totalTokens: 1000,
        costUsd: 0.05,
        durationMs: 18_000,
        intent: "thinking",
        agents: [{ agent: "knowledge", totalTokens: 800, costUsd: 0.04 }],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getThreadTurnUsage).mockResolvedValue(turnUsage);
  });

  it("super_admin は往復ごとの内訳を取得できる", async () => {
    useAuth("super_admin");
    const res = await routes.request(
      authedGet("/usage/threads/thread-1"),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(getThreadTurnUsage).toHaveBeenCalledWith(mockEnv.DB, "thread-1");
    expect(await res.json()).toEqual(turnUsage);
  });

  it("admin は 403", async () => {
    useAuth("admin");
    const res = await routes.request(
      authedGet("/usage/threads/thread-1"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /persona", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth("super_admin");
    vi.mocked(getPersonaAnalytics).mockResolvedValue(emptyPersonaAnalytics);
  });

  it("from/to（JST 日付）を UTC ISO に変換して渡す（to はその日を含む）", async () => {
    await routes.request(
      authedGet("/persona?from=2026-06-01&to=2026-06-07"),
      undefined,
      mockEnv,
    );

    expect(getPersonaAnalytics).toHaveBeenCalledWith(mockEnv.DB, {
      from: "2026-05-31T15:00:00.000Z",
      to: "2026-06-07T15:00:00.000Z",
    });
  });

  it("from/to 未指定なら期間条件なしで渡す", async () => {
    await routes.request(authedGet("/persona"), undefined, mockEnv);

    expect(getPersonaAnalytics).toHaveBeenCalledWith(mockEnv.DB, {
      from: undefined,
      to: undefined,
    });
  });

  it("日付形式でない from は 400", async () => {
    const res = await routes.request(
      authedGet("/persona?from=06/01"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth("super_admin");
    vi.mocked(getConversationStats).mockResolvedValue(emptyConversationStats);
    vi.useFakeTimers();
    // JST 2026-06-10(水) 11:00
    vi.setSystemTime(new Date("2026-06-10T02:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("days 日分を JST の日付境界で区切って集計する", async () => {
    const res = await routes.request(
      authedGet("/conversations?days=7"),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    // 7 日分 = JST 06-04 00:00 から現在まで
    expect(getConversationStats).toHaveBeenCalledWith(mockEnv.DB, {
      from: "2026-06-03T15:00:00.000Z",
      to: "2026-06-10T02:00:00.000Z",
    });
  });

  it("days > 30 は 400（保持期間を超える）", async () => {
    const res = await routes.request(
      authedGet("/conversations?days=31"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth("super_admin");
    vi.mocked(getWeeklyUsage).mockResolvedValue([]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T02:00:00.000Z")); // JST 水曜
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("weeks 週分を今週月曜起点で遡って集計する", async () => {
    const res = await routes.request(
      authedGet("/usage?weeks=2"),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    // 今週月曜 = JST 06-08、2 週分 = 先週月曜 JST 06-01 から
    expect(getWeeklyUsage).toHaveBeenCalledWith(mockEnv.DB, {
      from: "2026-05-31T15:00:00.000Z",
    });
  });
});

describe("GET /reports", () => {
  const storedReport = {
    id: "r-1",
    periodStart: "2026-06-08",
    periodEnd: "2026-06-14",
    stats: JSON.stringify({
      conversationCount: 10,
      messageCount: 25,
      hourly: [],
      platforms: [],
      usageByModel: [],
    }),
    summary: "今週のハイライト",
    createdAt: "2026-06-16T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth("super_admin");
  });

  it("一覧は stats を含まず返す", async () => {
    vi.mocked(weeklyReportRepository.list).mockResolvedValue([storedReport]);

    const res = await routes.request(authedGet("/reports"), undefined, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { reports: unknown[] };
    expect(body.reports).toEqual([
      {
        id: "r-1",
        periodStart: "2026-06-08",
        periodEnd: "2026-06-14",
        summary: "今週のハイライト",
        createdAt: "2026-06-16T00:00:00.000Z",
      },
    ]);
  });

  it("詳細は stats を JSON parse して返す", async () => {
    vi.mocked(weeklyReportRepository.findById).mockResolvedValue(storedReport);

    const res = await routes.request(
      authedGet("/reports/r-1"),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      report: { stats: { conversationCount: number } };
    };
    expect(body.report.stats.conversationCount).toBe(10);
  });

  it("コスト情報（usageByModel）は super_admin だけに返し、staff には空にする", async () => {
    const withUsage = {
      ...storedReport,
      stats: JSON.stringify({
        ...JSON.parse(storedReport.stats),
        usageByModel: [
          {
            model: "gemini-2.5-flash",
            inputTokens: 1000,
            outputTokens: 500,
            reasoningTokens: 0,
            cachedInputTokens: 0,
            totalTokens: 1500,
            costUsd: 0.0015,
          },
        ],
      }),
    };
    vi.mocked(weeklyReportRepository.findById).mockResolvedValue(withUsage);

    const superRes = await routes.request(
      authedGet("/reports/r-1"),
      undefined,
      mockEnv,
    );
    const superBody = (await superRes.json()) as {
      report: { stats: { usageByModel: unknown[] } };
    };
    expect(superBody.report.stats.usageByModel).toHaveLength(1);

    useAuth("staff");
    const staffRes = await routes.request(
      authedGet("/reports/r-1"),
      undefined,
      mockEnv,
    );
    expect(staffRes.status).toBe(200);
    const staffBody = (await staffRes.json()) as {
      report: { stats: { usageByModel: unknown[] } };
    };
    expect(staffBody.report.stats.usageByModel).toEqual([]);
  });

  it("存在しないレポートは 404", async () => {
    vi.mocked(weeklyReportRepository.findById).mockResolvedValue(undefined);

    const res = await routes.request(
      authedGet("/reports/missing"),
      undefined,
      mockEnv,
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /ontology", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("super_admin はグラフを返す", async () => {
    useAuth("super_admin");
    vi.mocked(getOntology).mockResolvedValue({
      nodes: [
        {
          id: "ent:音威子府駅",
          label: "音威子府駅",
          kind: "entity",
          count: 3,
          role: "関心点",
          roles: ["関心点"],
        },
      ],
      links: [],
      meta: {
        personaTotal: 3,
        generatedAt: "2026-06-15T00:00:00.000Z",
        entityLayerStatus: "ready",
        note: "",
      },
    });

    const res = await routes.request(
      authedGet("/ontology"),
      undefined,
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { meta: { entityLayerStatus: string } };
    expect(body.meta.entityLayerStatus).toBe("ready");
  });
});

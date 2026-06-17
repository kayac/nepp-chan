import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/analytics/aggregate", () => ({
  getConversationStats: vi.fn(),
  getWeeklyUsage: vi.fn(),
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

const { getConversationStats, getWeeklyUsage, getPersonaAnalytics } =
  await import("~/services/analytics/aggregate");
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

  it("staff は 403", async () => {
    useAuth("staff");
    const res = await routes.request(authedGet("/persona"), undefined, mockEnv);
    expect(res.status).toBe(403);
  });

  it("admin は 403", async () => {
    useAuth("admin");
    const res = await routes.request(authedGet("/persona"), undefined, mockEnv);
    expect(res.status).toBe(403);
  });

  it("super_admin は 200", async () => {
    useAuth("super_admin");
    const res = await routes.request(authedGet("/persona"), undefined, mockEnv);
    expect(res.status).toBe(200);
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

import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createAnalyticsRepository } from "./analytics-repository";

const repo = createAnalyticsRepository(testApiClient);

const emptyPersonaAnalytics = {
  totalCount: 0,
  ageSentiment: [],
  topics: [],
  segments: { residence: [], relationship: [] },
};

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("fetchPersonaAnalytics", () => {
  it("from/to をクエリで渡す", async () => {
    server.use(
      http.get(`${API}/admin/analytics/persona`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get("from")).toBe("2026-06-01");
        expect(params.get("to")).toBe("2026-06-07");
        return HttpResponse.json(emptyPersonaAnalytics);
      }),
    );

    const result = await repo.fetchPersonaAnalytics({
      from: "2026-06-01",
      to: "2026-06-07",
    });
    expect(result?.totalCount).toBe(0);
  });

  it("期間未指定でも取得できる", async () => {
    server.use(
      http.get(`${API}/admin/analytics/persona`, () =>
        HttpResponse.json(emptyPersonaAnalytics),
      ),
    );

    const result = await repo.fetchPersonaAnalytics();
    expect(result?.totalCount).toBe(0);
  });
});

describe("fetchOntology", () => {
  const emptyOntology = {
    nodes: [],
    links: [],
    meta: {
      personaTotal: 0,
      generatedAt: "2026-06-15T00:00:00.000Z",
      entityLayerStatus: "none",
      note: "",
    },
  };

  it("全ペルソナのグラフを取得する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/ontology`, () =>
        HttpResponse.json(emptyOntology),
      ),
    );

    const result = await repo.fetchOntology();
    expect(result?.nodes).toEqual([]);
  });
});

describe("fetchConversationAnalytics", () => {
  it("デフォルト days=30", async () => {
    server.use(
      http.get(`${API}/admin/analytics/conversations`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("days")).toBe("30");
        return HttpResponse.json({
          daily: [],
          hourly: [],
          platforms: [],
          totals: { conversations: 0, messages: 0 },
        });
      }),
    );

    const result = await repo.fetchConversationAnalytics();
    expect(result?.totals.conversations).toBe(0);
  });
});

describe("fetchUsageAnalytics", () => {
  it("weeks を渡せる", async () => {
    server.use(
      http.get(`${API}/admin/analytics/usage`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("weeks")).toBe("4");
        return HttpResponse.json({ weekly: [] });
      }),
    );

    const result = await repo.fetchUsageAnalytics(4);
    expect(result?.weekly).toEqual([]);
  });
});

describe("fetchThreadUsage", () => {
  it("daysとlimitを渡せる", async () => {
    server.use(
      http.get(`${API}/admin/analytics/usage/threads`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get("days")).toBe("7");
        expect(params.get("limit")).toBe("10");
        return HttpResponse.json({ summary: {}, threads: [] });
      }),
    );

    const result = await repo.fetchThreadUsage({ days: 7, limit: 10 });
    expect(result?.threads).toEqual([]);
  });
});

describe("fetchOperationCost", () => {
  it("デフォルトdays=30", async () => {
    server.use(
      http.get(`${API}/admin/analytics/usage/operation`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("days")).toBe("30");
        return HttpResponse.json({ totalCostUsd: 0, byCategory: [] });
      }),
    );

    const result = await repo.fetchOperationCost();
    expect(result?.totalCostUsd).toBe(0);
  });
});

describe("fetchThreadTurnUsage", () => {
  it("指定したスレッドのターン別利用量を取得する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/usage/threads/thread-1`, () =>
        HttpResponse.json({ turns: [] }),
      ),
    );

    const result = await repo.fetchThreadTurnUsage("thread-1");
    expect(result?.turns).toEqual([]);
  });
});

describe("fetchWeeklyReports", () => {
  it("一覧を取得する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/reports`, () =>
        HttpResponse.json({ reports: [] }),
      ),
    );

    const result = await repo.fetchWeeklyReports();
    expect(result?.reports).toEqual([]);
  });
});

describe("fetchWeeklyReportById", () => {
  it("404 は throw", async () => {
    server.use(
      http.get(`${API}/admin/analytics/reports/missing`, () =>
        HttpResponse.json(
          { error: { code: 404, message: "not found" } },
          { status: 404 },
        ),
      ),
    );

    await expect(repo.fetchWeeklyReportById("missing")).rejects.toBeDefined();
  });
});

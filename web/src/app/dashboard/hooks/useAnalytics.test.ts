import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useConversationAnalytics,
  usePersonaAnalytics,
  useUsageAnalytics,
  useWeeklyReportDetail,
  useWeeklyReports,
} from "./useAnalytics";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("usePersonaAnalytics", () => {
  it("from/to をクエリで送って集計を取得する", async () => {
    let received: { from: string | null; to: string | null } | null = null;
    server.use(
      http.get(`${API}/admin/analytics/persona`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        received = { from: params.get("from"), to: params.get("to") };
        return HttpResponse.json({
          totalCount: 3,
          hourly: [],
          weekday: [],
          officeHours: { open: 0, closed: 0 },
          ageSentiment: [],
          topics: [],
          segments: { residence: [], relationship: [] },
        });
      }),
    );

    const { result } = renderHookWithQuery(() =>
      usePersonaAnalytics({ from: "2026-06-01", to: "2026-06-07" }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalCount).toBe(3);
    expect(received).toEqual({ from: "2026-06-01", to: "2026-06-07" });
  });
});

describe("useConversationAnalytics", () => {
  it("days を送って会話量を取得する", async () => {
    let received: string | null = null;
    server.use(
      http.get(`${API}/admin/analytics/conversations`, ({ request }) => {
        received = new URL(request.url).searchParams.get("days");
        return HttpResponse.json({
          daily: [],
          hourly: [],
          weekday: [],
          platforms: [],
          totals: { conversations: 5, messages: 12 },
        });
      }),
    );

    const { result } = renderHookWithQuery(() => useConversationAnalytics(7));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totals.conversations).toBe(5);
    expect(received).toBe("7");
  });

  it("5xx エラー時に isError=true", async () => {
    server.use(
      http.get(`${API}/admin/analytics/conversations`, () =>
        HttpResponse.json({ error: "internal" }, { status: 500 }),
      ),
    );

    const { result } = renderHookWithQuery(() => useConversationAnalytics());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUsageAnalytics", () => {
  it("weeks を送って週次 usage を取得する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/usage`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("weeks")).toBe("4");
        return HttpResponse.json({ weekly: [] });
      }),
    );

    const { result } = renderHookWithQuery(() => useUsageAnalytics(4));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.weekly).toEqual([]);
  });
});

describe("useWeeklyReports / useWeeklyReportDetail", () => {
  it("レポート一覧を取得する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/reports`, () =>
        HttpResponse.json({
          reports: [
            {
              id: "r-1",
              periodStart: "2026-06-01",
              periodEnd: "2026-06-07",
              summary: "ハイライト",
              createdAt: "2026-06-09T00:00:00.000Z",
            },
          ],
        }),
      ),
    );

    const { result } = renderHookWithQuery(() => useWeeklyReports());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.reports).toHaveLength(1);
  });

  it("id が null の間は詳細を fetch しない", async () => {
    const { result } = renderHookWithQuery(() => useWeeklyReportDetail(null));

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("id 指定で詳細を取得する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/reports/r-1`, () =>
        HttpResponse.json({
          report: {
            id: "r-1",
            periodStart: "2026-06-01",
            periodEnd: "2026-06-07",
            summary: "ハイライト全文",
            createdAt: "2026-06-09T00:00:00.000Z",
            stats: {
              conversationCount: 10,
              messageCount: 30,
              hourly: [],
              platforms: [],
              usageByModel: [],
            },
          },
        }),
      ),
    );

    const { result } = renderHookWithQuery(() => useWeeklyReportDetail("r-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.report.stats.conversationCount).toBe(10);
  });
});

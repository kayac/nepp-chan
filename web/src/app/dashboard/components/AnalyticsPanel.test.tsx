import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { AnalyticsPanel } from "./AnalyticsPanel";

const API = "http://localhost:8787";

const conversationAnalytics = {
  daily: [{ date: "2026-06-09", conversations: 4, messages: 10 }],
  hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
  platforms: [{ platform: "line", count: 8 }],
  totals: { conversations: 4, messages: 10 },
};

const personaAnalytics = {
  totalCount: 2,
  ageSentiment: [
    { age: "60代", positive: 1, negative: 1, request: 0, neutral: 0 },
  ],
  topics: [
    {
      topic: "交通",
      total: 2,
      positive: 0,
      negative: 1,
      request: 1,
      neutral: 0,
    },
  ],
  segments: {
    residence: [{ label: "村内", count: 2 }],
    relationship: [{ label: "村人", count: 2 }],
  },
};

const usageAnalytics = {
  weekly: [
    {
      weekStart: "2026-06-01",
      model: "gemini-2.5-flash",
      inputTokens: 1000,
      outputTokens: 500,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      totalTokens: 1500,
      costUsd: 0.0015,
    },
  ],
};

const weeklyReports = {
  reports: [
    {
      id: "r-1",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-07",
      summary: "今週は交通の話題が中心でした。",
      createdAt: "2026-06-09T00:00:00.000Z",
    },
  ],
};

const weeklyReportDetail = {
  report: {
    ...weeklyReports.reports[0],
    stats: {
      conversationCount: 4,
      messageCount: 10,
      hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
      platforms: [{ platform: "line", count: 8 }],
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
    },
  },
};

const useSuccessHandlers = () => {
  server.use(
    http.get(`${API}/admin/analytics/conversations`, () =>
      HttpResponse.json(conversationAnalytics),
    ),
    http.get(`${API}/admin/analytics/persona`, () =>
      HttpResponse.json(personaAnalytics),
    ),
    http.get(`${API}/admin/analytics/usage`, () =>
      HttpResponse.json(usageAnalytics),
    ),
    http.get(`${API}/admin/analytics/reports`, () =>
      HttpResponse.json(weeklyReports),
    ),
    http.get(`${API}/admin/analytics/reports/r-1`, () =>
      HttpResponse.json(weeklyReportDetail),
    ),
  );
};

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("AnalyticsPanel", () => {
  it("4 セクションの見出しを表示する", async () => {
    useSuccessHandlers();

    renderWithQuery(<AnalyticsPanel />);

    expect(screen.getByText("会話量")).toBeInTheDocument();
    expect(screen.getByText("トークン消費・コスト")).toBeInTheDocument();
    expect(screen.getByText("ペルソナ分析")).toBeInTheDocument();
    expect(screen.getByText("週次レポート")).toBeInTheDocument();
  });

  it("取得したサマリー数値を表示する", async () => {
    useSuccessHandlers();

    renderWithQuery(<AnalyticsPanel />);

    await waitFor(() => {
      expect(screen.getByText("会話数")).toBeInTheDocument();
    });
    // 会話数 4（会話量セクションのサマリーカード）
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("usage データが空のときは案内文を表示する", async () => {
    useSuccessHandlers();
    server.use(
      http.get(`${API}/admin/analytics/usage`, () =>
        HttpResponse.json({ weekly: [] }),
      ),
    );

    renderWithQuery(<AnalyticsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/まだ記録がありません/)).toBeInTheDocument();
    });
  });

  it("API エラー時はセクション内にエラーを表示する", async () => {
    useSuccessHandlers();
    server.use(
      http.get(`${API}/admin/analytics/conversations`, () =>
        HttpResponse.json(
          { error: { code: 500, message: "boom" } },
          { status: 500 },
        ),
      ),
    );

    renderWithQuery(<AnalyticsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/エラー:/)).toBeInTheDocument();
    });
  });

  it("週次レポートを選択すると詳細（ハイライト全文）を表示する", async () => {
    useSuccessHandlers();
    const user = userEvent.setup();

    renderWithQuery(<AnalyticsPanel />);

    const reportButton = await screen.findByRole("button", {
      name: /2026-06-01 〜 2026-06-07/,
    });
    await user.click(reportButton);

    await waitFor(() => {
      expect(screen.getByText("今週のハイライト")).toBeInTheDocument();
    });
  });
});

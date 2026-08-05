import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { AnalyticsPanel } from "./AnalyticsPanel";

const API = "http://localhost:8787";

const conversationAnalytics = {
  daily: [{ date: "2026-06-09", conversations: 4, messages: 10 }],
  hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
  weekday: Array.from({ length: 7 }, (_, dow) => ({ dow, count: 0 })),
  platforms: [{ platform: "line", count: 8 }],
  totals: { conversations: 4, messages: 10 },
};

const personaAnalytics = {
  totalCount: 2,
  hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
  weekday: Array.from({ length: 7 }, (_, dow) => ({ dow, count: 0 })),
  officeHours: { open: 1, closed: 1 },
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

const ontologyAnalytics = {
  nodes: [
    {
      id: "seg:村内住民",
      label: "村内住民",
      kind: "segment",
      count: 2,
      role: "セグメント",
      roles: [],
    },
    {
      id: "top:交通",
      label: "交通",
      kind: "topic",
      count: 2,
      role: "関心点",
      roles: ["関心点"],
      bySegment: { 村内住民: 2 },
      bySentiment: { neutral: 2 },
    },
  ],
  links: [
    { source: "seg:村内住民", target: "top:交通", n: 2, kind: "seg-topic" },
  ],
  meta: {
    personaTotal: 2,
    generatedAt: "2026-06-09T00:00:00.000Z",
    entityLayerStatus: "none",
    note: "",
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
    http.get(`${API}/admin/analytics/ontology`, () =>
      HttpResponse.json(ontologyAnalytics),
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
  it("3つの時間軸見出しとセクションを順に表示する", async () => {
    useSuccessHandlers();

    renderWithQuery(<AnalyticsPanel />);

    expect(screen.getByText("今週のできごと")).toBeInTheDocument();
    expect(screen.getByText("最近の動き")).toBeInTheDocument();
    expect(screen.getByText("村の全体像")).toBeInTheDocument();
    expect(screen.getByText("週次レポート")).toBeInTheDocument();
    expect(screen.getByText("会話量")).toBeInTheDocument();
    expect(screen.getByText("全体分析")).toBeInTheDocument();
    expect(screen.queryByText("トークン消費・コスト")).toBeNull();
  });

  it("閉庁時間の文脈文を表示する", async () => {
    useSuccessHandlers();

    renderWithQuery(<AnalyticsPanel />);

    await waitFor(() => {
      // 開庁 1 / 閉庁 1 → 2件に1件（全体の50%）
      expect(
        screen.getByText(/2件に1件はねっぷちゃんが応対しています/),
      ).toBeInTheDocument();
    });
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

  it("initialSection 指定で該当セクションへスクロールする", async () => {
    useSuccessHandlers();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderWithQuery(<AnalyticsPanel initialSection="conversation" />);

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it("initialSection なしではスクロールしない", async () => {
    useSuccessHandlers();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderWithQuery(<AnalyticsPanel />);

    expect(screen.getByText("最近の動き")).toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("💬 聞くで各時間軸の文脈つきに onAskMayor が呼ばれる", async () => {
    useSuccessHandlers();
    const onAskMayor = vi.fn();
    const user = userEvent.setup();

    renderWithQuery(<AnalyticsPanel onAskMayor={onAskMayor} />);

    const askButtons = screen.getAllByRole("button", { name: "💬 聞く" });
    expect(askButtons).toHaveLength(3);

    await user.click(askButtons[0]);
    expect(onAskMayor).toHaveBeenCalledWith("直近30日の会話データ");

    await user.click(askButtons[2]);
    expect(onAskMayor).toHaveBeenCalledWith("今週の週次レポート");
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

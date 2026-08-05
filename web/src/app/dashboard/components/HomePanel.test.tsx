import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { HomePanel } from "./HomePanel";

const API = "http://localhost:8787";

// 2026-08-03（月）。直近7日 = 07-28〜08-03
const NOW = new Date("2026-08-03T10:00:00");

const positiveTopics = [
  {
    topic: "観光",
    total: 20,
    sentiments: { positive: 20, negative: 0, request: 0, neutral: 0 },
    sample: "音威子府そばがとても美味しかった",
    topTags: [
      { tag: "そば", count: 3 },
      { tag: "駅", count: 2 },
    ],
  },
];

const troubleTopics = [
  {
    topic: "生活",
    total: 6,
    sentiments: { positive: 0, negative: 6, request: 0, neutral: 0 },
    sample: "粗大ごみの出し方がわかりにくい",
    topTags: [{ tag: "粗大ごみ", count: 3 }],
  },
];

const useDefaultHandlers = () => {
  server.use(
    http.get(`${API}/admin/analytics/conversations`, () =>
      HttpResponse.json({
        daily: [
          { date: "2026-08-02", conversations: 4, messages: 12 },
          { date: "2026-08-03", conversations: 6, messages: 20 },
        ],
        hourly: [{ hour: 19, count: 30 }],
        weekday: [],
        platforms: [
          { platform: "line", count: 20 },
          { platform: "web", count: 14 },
          { platform: "admin", count: 4 },
        ],
        totals: { conversations: 34, messages: 120 },
      }),
    ),
    http.get(`${API}/admin/analytics/persona`, () =>
      HttpResponse.json({
        totalCount: 21,
        hourly: [],
        weekday: [],
        officeHours: { open: 40, closed: 60 },
        ageSentiment: [
          { age: "50代", positive: 5, negative: 3, request: 0, neutral: 0 },
          { age: "不明", positive: 0, negative: 0, request: 0, neutral: 30 },
        ],
        topics: [
          {
            topic: "観光",
            total: 12,
            positive: 8,
            negative: 1,
            request: 3,
            neutral: 0,
          },
          {
            topic: "生活",
            total: 9,
            positive: 0,
            negative: 4,
            request: 0,
            neutral: 5,
          },
        ],
        segments: {
          residence: [{ label: "村内", count: 12 }],
          relationship: [{ label: "村人", count: 10 }],
        },
      }),
    ),
    http.get(`${API}/admin/persona/topics`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      return HttpResponse.json({
        topics:
          params.get("sentiments") === "positive,neutral"
            ? positiveTopics
            : troubleTopics,
      });
    }),
    http.get(`${API}/admin/broadcast`, () =>
      HttpResponse.json({
        broadcasts: [
          {
            id: "b-1",
            title: "ゴミ収集日の変更のお知らせ",
            body: "",
            parts: [],
            status: "scheduled",
            scheduledAt: "2026-08-05T23:00:00Z",
            sentAt: null,
            errorMessage: null,
            createdBy: "admin",
            createdAt: "2026-08-01T00:00:00Z",
            updatedAt: null,
          },
        ],
        total: 1,
        nextCursor: null,
      }),
    ),
    http.get(`${API}/admin/polls`, () =>
      HttpResponse.json({
        polls: [
          {
            id: "p-1",
            title: "夏まつりの出店、何がいい？",
            choices: ["やきそば", "かき氷"],
            followUpPrompt: null,
            status: "sent",
            createdBy: "admin",
            createdAt: "2026-07-25T00:00:00Z",
            updatedAt: null,
            scheduledAt: null,
            sentAt: "2026-07-26T00:00:00Z",
            closedAt: null,
            answerCount: 24,
          },
        ],
        total: 1,
        nextCursor: null,
      }),
    ),
  );
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("HomePanel", () => {
  it("見出しに直近7日の実日付を出す", async () => {
    useDefaultHandlers();
    renderWithQuery(
      <HomePanel onNavigate={vi.fn()} onShowAnalytics={vi.fn()} />,
    );

    expect(screen.getByText("今週の音威子府")).toBeVisible();
    expect(screen.getByText(/7月28日〜8月3日の声から/)).toBeVisible();
  });

  it("取得中は空文言ではなく読み込み中を出す", async () => {
    useDefaultHandlers();
    renderWithQuery(
      <HomePanel onNavigate={vi.fn()} onShowAnalytics={vi.fn()} />,
    );

    expect(screen.getByText("読み込み中...")).toBeVisible();
    expect(screen.queryByText(/声がありません/)).toBeNull();

    await waitFor(() => {
      expect(screen.getByText("✨ 今週の話題")).toBeVisible();
    });
    expect(screen.queryByText("読み込み中...")).toBeNull();
  });

  it("ポジの話題と困りごとを別カードに件数・タグ・声つきで出す", async () => {
    useDefaultHandlers();
    renderWithQuery(
      <HomePanel onNavigate={vi.fn()} onShowAnalytics={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("✨ 今週の話題")).toBeVisible();
      expect(screen.getByText("⚠️ 今週の困りごと")).toBeVisible();
    });
    const rows = screen.getAllByTestId("topic-row");
    expect(rows[0].textContent).toContain("観光");
    expect(rows[0].textContent).toContain("20件");
    expect(rows[0].textContent).toContain("そば ×3");
    expect(rows[0].textContent).toContain(
      "「音威子府そばがとても美味しかった」",
    );
    expect(rows[1].textContent).toContain("生活");
    expect(rows[1].textContent).toContain("粗大ごみ ×3");
    expect(rows[1].textContent).toContain("「粗大ごみの出し方がわかりにくい」");
  });

  it("話題別で見るで話題ビューに遷移する", async () => {
    const onNavigate = vi.fn();
    useDefaultHandlers();
    renderWithQuery(
      <HomePanel onNavigate={onNavigate} onShowAnalytics={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("✨ 今週の話題")).toBeVisible();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /話題別で見る/ }));
    expect(onNavigate).toHaveBeenCalledWith("voices", {
      period: "d7",
      sort: "topics",
    });
  });

  it("話題の行クリックでその話題と感情に絞った声一覧へ遷移する", async () => {
    const onNavigate = vi.fn();
    useDefaultHandlers();
    renderWithQuery(
      <HomePanel onNavigate={onNavigate} onShowAnalytics={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("⚠️ 今週の困りごと")).toBeVisible();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /粗大ごみ ×3/ }));
    expect(onNavigate).toHaveBeenCalledWith("voices", {
      period: "d7",
      topic: "生活",
      sents: ["negative", "request"],
    });

    await user.click(screen.getByRole("button", { name: /そば ×3/ }));
    expect(onNavigate).toHaveBeenCalledWith("voices", {
      period: "d7",
      topic: "観光",
      sents: ["positive"],
    });
  });

  it("今週のサマリーに会話数と声の数を出し、村の分析へ遷移できる", async () => {
    const onShowAnalytics = vi.fn();
    useDefaultHandlers();
    renderWithQuery(
      <HomePanel onNavigate={vi.fn()} onShowAnalytics={onShowAnalytics} />,
    );

    await waitFor(() => {
      expect(screen.getByText("📊 今週のサマリー")).toBeVisible();
    });
    const strip = screen.getByTestId("activity-strip");
    expect(strip.textContent).toContain("会話 34件");
    expect(strip.textContent).toContain("集まった声 21件");
    expect(strip.textContent).toContain("LINE 20 · Web 14");
    expect(strip.textContent).not.toContain("管理者");

    const user = userEvent.setup();
    const links = screen.getAllByRole("button", { name: /村の分析で見る/ });
    await user.click(links[0]);
    expect(onShowAnalytics).toHaveBeenCalledWith();

    await user.click(screen.getByRole("button", { name: /会話 34/ }));
    expect(onShowAnalytics).toHaveBeenCalledWith("conversation");

    await user.click(screen.getByRole("button", { name: /集まった声 21/ }));
    expect(onShowAnalytics).toHaveBeenCalledWith("overview");
  });

  it("サマリーに声の内訳と声の分布を出す", async () => {
    useDefaultHandlers();
    renderWithQuery(
      <HomePanel onNavigate={vi.fn()} onShowAnalytics={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("sentiment-breakdown")).toBeInTheDocument();
    });
    // 期待値は topics 2 行の合算
    const breakdown = screen.getByTestId("sentiment-breakdown");
    expect(breakdown.textContent).toContain("ポジティブ 8");
    expect(breakdown.textContent).toContain("ネガティブ 5");
    expect(breakdown.textContent).toContain("要望 3");

    const speakers = screen.getByTestId("speaker-breakdown");
    // 年代の件数は sentiment 内訳の合算
    expect(speakers.textContent).toContain("50代 8");
    expect(speakers.textContent).toContain("村内 12");
    expect(speakers.textContent).toContain("村人 10");
    expect(speakers.textContent).not.toContain("不明");
  });

  it("サマリーの感情から声一覧へ絞り込んで遷移する", async () => {
    const onNavigate = vi.fn();
    useDefaultHandlers();
    renderWithQuery(
      <HomePanel onNavigate={onNavigate} onShowAnalytics={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("sentiment-breakdown")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /要望 3/ }));
    expect(onNavigate).toHaveBeenCalledWith("voices", {
      period: "d7",
      sents: ["request"],
    });
  });

  it("会話数の単独カードは出さない", async () => {
    useDefaultHandlers();
    renderWithQuery(
      <HomePanel onNavigate={vi.fn()} onShowAnalytics={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("✨ 今週の話題")).toBeVisible();
    });
    expect(screen.queryByText(/最近の会話/)).toBeNull();
    expect(screen.getAllByText(/村の分析で見る/).length).toBeGreaterThan(0);
  });

  it("予約中の配信と実施中の投票を表示する", async () => {
    useDefaultHandlers();
    renderWithQuery(
      <HomePanel onNavigate={vi.fn()} onShowAnalytics={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("ゴミ収集日の変更のお知らせ")).toBeVisible();
      expect(screen.getByText("夏まつりの出店、何がいい？")).toBeVisible();
    });
  });

  it("実施中の投票に開始日と回答数を出す", async () => {
    useDefaultHandlers();
    renderWithQuery(
      <HomePanel onNavigate={vi.fn()} onShowAnalytics={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("夏まつりの出店、何がいい？")).toBeVisible();
    });
    expect(screen.getByText(/7月26日開始/)).toBeVisible();
    expect(screen.getByText(/24件の回答/)).toBeVisible();
  });

  it("取得に失敗したら空状態ではなくエラーを出す", async () => {
    useDefaultHandlers();
    server.use(
      http.get(`${API}/admin/persona/topics`, () =>
        HttpResponse.json({ error: "internal" }, { status: 500 }),
      ),
    );
    renderWithQuery(
      <HomePanel onNavigate={vi.fn()} onShowAnalytics={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/エラー:/)).toBeInTheDocument();
    });
    expect(screen.queryByText("✨ 今週の話題")).toBeNull();
    expect(screen.queryByText(/この3日はまだ新しい声がありません/)).toBeNull();
  });
});

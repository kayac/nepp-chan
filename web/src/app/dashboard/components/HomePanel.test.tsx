import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { HomePanel } from "./HomePanel";

const API = "http://localhost:8787";

const emptyPersonaAnalytics = {
  totalCount: 0,
  hourly: [],
  weekday: [],
  officeHours: { open: 0, closed: 0 },
  ageSentiment: [],
  topics: [],
  segments: { residence: [], relationship: [] },
};

const topic = (
  name: string,
  counts: Partial<{
    total: number;
    positive: number;
    negative: number;
    request: number;
    neutral: number;
  }>,
) => ({
  topic: name,
  total: counts.total ?? 0,
  positive: counts.positive ?? 0,
  negative: counts.negative ?? 0,
  request: counts.request ?? 0,
  neutral: counts.neutral ?? 0,
});

// 2026-07-29（水）固定。今週 = 07-27〜07-29、前週 = 07-20〜07-26
const NOW = new Date("2026-07-29T10:00:00");

const useDefaultHandlers = ({
  emergencies = [] as unknown[],
} = {}) => {
  server.use(
    http.get(`${API}/admin/analytics/persona`, ({ request }) => {
      const from = new URL(request.url).searchParams.get("from");
      if (from === "2026-07-27") {
        return HttpResponse.json({
          ...emptyPersonaAnalytics,
          totalCount: 15,
          topics: [
            topic("観光", { total: 6, positive: 4, negative: 1, request: 1 }),
            topic("生活", { total: 5, negative: 3, request: 1, neutral: 1 }),
            topic("行政", { total: 4, neutral: 4 }),
          ],
        });
      }
      return HttpResponse.json({
        ...emptyPersonaAnalytics,
        totalCount: 8,
        topics: [
          topic("観光", { total: 3, negative: 1 }),
          topic("生活", { total: 5, negative: 4, request: 1 }),
        ],
      });
    }),
    http.get(`${API}/admin/analytics/conversations`, () =>
      HttpResponse.json({
        daily: [
          { date: "2026-07-21", conversations: 25, messages: 60 },
          { date: "2026-07-27", conversations: 10, messages: 30 },
          { date: "2026-07-28", conversations: 20, messages: 55 },
          { date: "2026-07-29", conversations: 5, messages: 12 },
        ],
        hourly: [],
        weekday: [],
        platforms: [],
        totals: { conversations: 60, messages: 157 },
      }),
    ),
    http.get(`${API}/admin/emergency`, () =>
      HttpResponse.json({ emergencies }),
    ),
    http.get(`${API}/admin/broadcast`, () =>
      HttpResponse.json({
        broadcasts: [
          {
            id: "b-1",
            title: "ゴミ収集日の変更のお知らせ",
            body: "",
            parts: [],
            status: "scheduled",
            scheduledAt: "2026-07-31T23:00:00Z",
            sentAt: null,
            errorMessage: null,
            createdBy: "admin",
            createdAt: "2026-07-28T00:00:00Z",
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
  it("今週の困りごとをネガ+要望の多い順に件数付きで表示する", async () => {
    useDefaultHandlers();
    renderWithQuery(<HomePanel onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("今週の困りごと")).toBeDefined();
    });
    const items = screen.getAllByTestId("trouble-topic");
    expect(items[0].textContent).toContain("生活");
    expect(items[0].textContent).toContain("4");
    expect(items[1].textContent).toContain("観光");
  });

  it("トップトピックで前週になかった話題に NEW を付ける", async () => {
    useDefaultHandlers();
    renderWithQuery(<HomePanel onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("トップトピック")).toBeDefined();
    });
    const rows = screen.getAllByTestId("top-topic");
    expect(rows[0].textContent).toContain("観光");
    const gyousei = rows.find((r) => r.textContent?.includes("行政"));
    expect(gyousei?.textContent).toContain("NEW");
  });

  it("今週の緊急報告があれば最上部に表示し、みんなの声へ遷移できる", async () => {
    const onNavigate = vi.fn();
    useDefaultHandlers({
      emergencies: [
        {
          id: "e-1",
          type: "熊の出没",
          description: "物満内地区の農道付近で子熊を目撃",
          location: "物満内",
          reportedAt: "2026-07-28T08:40:00Z",
          updatedAt: null,
        },
      ],
    });
    renderWithQuery(<HomePanel onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/熊の出没/)).toBeDefined();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /みんなの声で見る/ }));
    expect(onNavigate).toHaveBeenCalledWith("voices");
  });

  it("先週以前の緊急報告しかなければ緊急セクションを出さない", async () => {
    useDefaultHandlers({
      emergencies: [
        {
          id: "e-old",
          type: "停電",
          description: "村落部",
          location: null,
          reportedAt: "2026-07-20T00:00:00Z",
          updatedAt: null,
        },
      ],
    });
    renderWithQuery(<HomePanel onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("今週の困りごと")).toBeDefined();
    });
    expect(screen.queryByText("緊急の報告")).toBeNull();
  });

  it("予約中の配信と実施中の投票を表示する", async () => {
    useDefaultHandlers();
    renderWithQuery(<HomePanel onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("ゴミ収集日の変更のお知らせ")).toBeDefined();
      expect(screen.getByText("夏まつりの出店、何がいい？")).toBeDefined();
    });
  });

  it("参考の数字に今週の会話数と先週比を表示し、村の分析へ遷移できる", async () => {
    const onNavigate = vi.fn();
    useDefaultHandlers();
    renderWithQuery(<HomePanel onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/今週の会話 35/)).toBeDefined();
    });
    expect(screen.getByText(/40%/)).toBeDefined();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /村の分析で見る/ }));
    expect(onNavigate).toHaveBeenCalledWith("analytics");
  });

  it("お知らせを作るで LINE配信へ遷移できる", async () => {
    const onNavigate = vi.fn();
    useDefaultHandlers();
    renderWithQuery(<HomePanel onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(screen.getByText("トップトピック")).toBeDefined();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /お知らせを作る/ }));
    expect(onNavigate).toHaveBeenCalledWith("broadcast");
  });
});

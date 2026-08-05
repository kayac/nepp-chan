import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import { useHomeSummary } from "./useHomeSummary";

const API = "http://localhost:8787";

// 2026-08-03（月）。直近7日 = 07-28〜08-03
const NOW = new Date("2026-08-03T10:00:00");

const topic = (
  name: string,
  total: number,
  sentiments: Partial<Record<string, number>>,
  topTags: { tag: string; count: number }[] = [],
  sample = `${name}の声`,
) => ({
  topic: name,
  total,
  sentiments: {
    positive: sentiments.positive ?? 0,
    negative: sentiments.negative ?? 0,
    request: sentiments.request ?? 0,
    neutral: sentiments.neutral ?? 0,
  },
  sample,
  topTags,
});

type Options = {
  positiveTopics?: ReturnType<typeof topic>[];
  troubleTopics?: ReturnType<typeof topic>[];
};

const useHandlers = ({
  positiveTopics = [],
  troubleTopics = [],
}: Options = {}) => {
  const topicCalls: URLSearchParams[] = [];
  const activityCalls: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/admin/analytics/conversations`, ({ request }) => {
      activityCalls.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        daily: [
          { date: "2026-08-02", conversations: 4, messages: 12 },
          { date: "2026-08-03", conversations: 6, messages: 20 },
        ],
        hourly: [
          { hour: 9, count: 10 },
          { hour: 19, count: 30 },
        ],
        weekday: [],
        platforms: [
          { platform: "line", count: 20 },
          { platform: "web", count: 14 },
          { platform: "admin", count: 4 },
        ],
        totals: { conversations: 34, messages: 120 },
      });
    }),
    http.get(`${API}/admin/analytics/persona`, () =>
      HttpResponse.json({
        totalCount: 21,
        hourly: [],
        weekday: [],
        officeHours: { open: 40, closed: 60 },
        ageSentiment: [
          { age: "50代", positive: 5, negative: 3, request: 0, neutral: 0 },
          { age: "40代", positive: 1, negative: 0, request: 0, neutral: 1 },
          { age: "30代", positive: 1, negative: 0, request: 0, neutral: 0 },
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
          residence: [
            { label: "村内", count: 12 },
            { label: "不明", count: 40 },
          ],
          relationship: [{ label: "村人", count: 10 }],
        },
      }),
    ),
    http.get(`${API}/admin/persona/topics`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      topicCalls.push(params);
      return HttpResponse.json({
        topics:
          params.get("sentiments") === "positive"
            ? positiveTopics
            : troubleTopics,
      });
    }),
    http.get(`${API}/admin/broadcast`, () =>
      HttpResponse.json({ broadcasts: [], total: 0, nextCursor: null }),
    ),
    http.get(`${API}/admin/polls`, () =>
      HttpResponse.json({ polls: [], total: 0, nextCursor: null }),
    ),
  );
  return { topicCalls, activityCalls };
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

describe("useHomeSummary", () => {
  it("期間ラベルは今日を含む7日", async () => {
    useHandlers();
    const { result } = renderHookWithQuery(() => useHomeSummary());

    expect(result.current.periodLabel).toEqual({
      from: "2026-07-28",
      to: "2026-08-03",
    });
  });

  it("集計は直近7日で、ポジと困りごとを別々の感情絞りで引く", async () => {
    const { topicCalls } = useHandlers();
    renderHookWithQuery(() => useHomeSummary());

    await waitFor(() => expect(topicCalls.length).toBeGreaterThanOrEqual(2));
    expect(topicCalls.every((c) => c.get("from") === "2026-07-28")).toBe(true);
    expect(topicCalls.some((c) => c.get("sentiments") === "positive")).toBe(
      true,
    );
    expect(
      topicCalls.some((c) => c.get("sentiments") === "negative,request"),
    ).toBe(true);
  });

  it("ポジと困りごとは各集計の上位4件を件数降順で返す", async () => {
    useHandlers({
      positiveTopics: [
        topic("行政", 2, { positive: 2 }),
        topic("観光", 8, { positive: 8 }),
        topic("生活", 3, { positive: 3 }),
        topic("教育", 1, { positive: 1 }),
        topic("移住", 1, { positive: 1 }),
      ],
      troubleTopics: [topic("医療", 4, { negative: 4 })],
    });
    const { result } = renderHookWithQuery(() => useHomeSummary());

    await waitFor(() => expect(result.current.positives).toHaveLength(4));
    expect(result.current.positives.map((t) => t.topic)).toEqual([
      "観光",
      "生活",
      "行政",
      "教育",
    ]);
    expect(result.current.troubles.map((t) => t.topic)).toEqual(["医療"]);
  });

  it("行は件数・タグ・代表の声を集計から引き継ぐ", async () => {
    useHandlers({
      troubleTopics: [
        topic(
          "生活",
          5,
          { negative: 5 },
          [{ tag: "粗大ごみ", count: 3 }],
          "粗大ごみの出し方がわかりにくい",
        ),
      ],
    });
    const { result } = renderHookWithQuery(() => useHomeSummary());

    await waitFor(() => expect(result.current.troubles).toHaveLength(1));
    expect(result.current.troubles[0]).toEqual({
      topic: "生活",
      count: 5,
      chips: [{ tag: "粗大ごみ", count: 3 }],
      sample: "粗大ごみの出し方がわかりにくい",
    });
  });

  it("今週のサマリーとして直近7日の会話数と声の数を返す", async () => {
    const { activityCalls } = useHandlers();
    const { result } = renderHookWithQuery(() => useHomeSummary());

    await waitFor(() => expect(result.current.conversationCount).toBe(34));
    expect(result.current.voiceCount).toBe(21);
    expect(activityCalls[0].get("days")).toBe("7");
  });

  it("日別の会話数を曜日つきラベルのグラフ用データにする", async () => {
    useHandlers();
    const { result } = renderHookWithQuery(() => useHomeSummary());

    await waitFor(() => expect(result.current.bars).toHaveLength(2));
    expect(result.current.bars[0]).toEqual({
      date: "2026-08-02",
      label: "8/2(日)",
      conversations: 4,
      closed: true,
    });
    expect(result.current.platforms).toEqual([
      { platform: "line", count: 20 },
      { platform: "web", count: 14 },
    ]);
  });

  it("管理画面からの会話は流入元に含めない", async () => {
    useHandlers();
    const { result } = renderHookWithQuery(() => useHomeSummary());

    await waitFor(() => expect(result.current.platforms).toHaveLength(2));
    expect(result.current.platforms.some((p) => p.platform === "admin")).toBe(
      false,
    );
  });

  it("声の内訳は話題ごとの sentiment を合算する", async () => {
    useHandlers();
    const { result } = renderHookWithQuery(() => useHomeSummary());

    await waitFor(() =>
      expect(result.current.sentiments).toEqual({
        positive: 8,
        negative: 5,
        request: 3,
        neutral: 5,
      }),
    );
  });

  it("声の分布は各区分の上位2件で、不明は除く", async () => {
    useHandlers();
    const { result } = renderHookWithQuery(() => useHomeSummary());

    await waitFor(() => expect(result.current.ages).toHaveLength(2));
    expect(result.current.ages).toEqual([
      { label: "50代", count: 8 },
      { label: "40代", count: 2 },
    ]);
    expect(result.current.residences).toEqual([{ label: "村内", count: 12 }]);
    expect(result.current.relationships).toEqual([
      { label: "村人", count: 10 },
    ]);
  });
});

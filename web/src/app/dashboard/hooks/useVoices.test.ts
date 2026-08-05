import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import { useVoices } from "./useVoices";

const API = "http://localhost:8787";

const persona = (id: string, endedAt: string) => ({
  id,
  category: "impression",
  tags: null,
  content: `${id} の声`,
  source: "chat",
  topic: "生活",
  sentiment: "negative",
  demographicSummary: null,
  createdAt: endedAt,
  updatedAt: null,
  conversationEndedAt: endedAt,
});

const emergency = (id: string, reportedAt: string) => ({
  id,
  type: "熊の出没",
  description: "農道付近で子熊を目撃",
  location: "物満内",
  reportedAt,
  updatedAt: null,
});

type Handlers = {
  personas?: ReturnType<typeof persona>[];
  emergencies?: ReturnType<typeof emergency>[];
  total?: number;
  pages?: ReturnType<typeof persona>[][];
};

const useHandlers = ({
  personas = [],
  emergencies = [],
  total,
  pages,
}: Handlers = {}) => {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/admin/persona`, ({ request }) => {
      const url = new URL(request.url);
      calls.push(url.searchParams);
      if (pages) {
        const index = url.searchParams.get("cursor")
          ? Number(url.searchParams.get("cursor"))
          : 0;
        const isLast = index >= pages.length - 1;
        return HttpResponse.json({
          personas: pages[index],
          total: total ?? pages.flat().length,
          nextCursor: isLast ? null : String(index + 1),
          hasMore: !isLast,
        });
      }
      return HttpResponse.json({
        personas,
        total: total ?? personas.length,
        nextCursor: null,
        hasMore: false,
      });
    }),
    http.get(`${API}/admin/persona/topics`, () =>
      HttpResponse.json({
        topics: [
          {
            topic: "生活",
            total: 2,
            sentiments: { positive: 0, negative: 2, request: 0, neutral: 0 },
            sample: "粗大ごみの出し方がわかりにくい",
          },
        ],
      }),
    ),
    http.get(`${API}/admin/emergency`, () =>
      HttpResponse.json({ emergencies }),
    ),
  );
  return calls;
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-07-29T10:00:00"));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe("useVoices", () => {
  it("ペルソナと緊急を混ぜて新しい順に返す", async () => {
    useHandlers({
      personas: [persona("p-1", "2026-07-27T00:00:00+09:00")],
      emergencies: [emergency("e-1", "2026-07-28T08:40:00+09:00")],
    });
    const { result } = renderHookWithQuery(() => useVoices());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.voices.map((v) => v.id)).toEqual(["e-1", "p-1"]);
  });

  it("該当件数はサーバーの total と期間内の緊急件数の合計", async () => {
    useHandlers({
      personas: [persona("p-1", "2026-07-27T00:00:00+09:00")],
      total: 120,
      emergencies: [emergency("e-1", "2026-07-28T08:40:00+09:00")],
    });
    const { result } = renderHookWithQuery(() => useVoices());

    await waitFor(() => expect(result.current.matchCount).toBe(121));
  });

  it("期間外の緊急は数えず表示もしない", async () => {
    useHandlers({
      personas: [persona("p-1", "2026-07-27T00:00:00+09:00")],
      emergencies: [emergency("e-old", "2026-01-01T00:00:00+09:00")],
    });
    const { result } = renderHookWithQuery(() => useVoices());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.voices.map((v) => v.id)).toEqual(["p-1"]);
    expect(result.current.matchCount).toBe(1);
  });

  it("未読み込みページより古い緊急は混ぜない（並びが崩れるため）", async () => {
    useHandlers({
      pages: [
        [persona("p-new", "2026-07-28T00:00:00+09:00")],
        [persona("p-old", "2026-07-10T00:00:00+09:00")],
      ],
      emergencies: [emergency("e-mid", "2026-07-15T00:00:00+09:00")],
    });
    const { result } = renderHookWithQuery(() => useVoices());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // 1ページ目の最古は 07-28。07-15 の緊急は次ページを読むまで出さない
    expect(result.current.voices.map((v) => v.id)).toEqual(["p-new"]);
    // 件数としては期間内なので数える
    expect(result.current.matchCount).toBe(3);
  });

  it("最終ページまで読み込めば期間内の緊急をすべて混ぜる", async () => {
    useHandlers({
      personas: [persona("p-new", "2026-07-28T00:00:00+09:00")],
      emergencies: [emergency("e-mid", "2026-07-15T00:00:00+09:00")],
    });
    const { result } = renderHookWithQuery(() => useVoices());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.voices.map((v) => v.id)).toEqual(["p-new", "e-mid"]);
  });

  it("話題ごとはサーバー集計を返し、緊急を1グループとして足す", async () => {
    useHandlers({
      personas: [persona("p-1", "2026-07-27T00:00:00+09:00")],
      emergencies: [emergency("e-1", "2026-07-28T08:40:00+09:00")],
    });
    const { result } = renderHookWithQuery(() => useVoices({ sort: "topics" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.topics.map((t) => t.topic)).toEqual(["生活", "緊急"]);
    expect(result.current.topics.find((t) => t.topic === "緊急")).toMatchObject(
      {
        total: 1,
        sample: "熊の出没：農道付近で子熊を目撃",
      },
    );
  });

  it("新しい順では話題ごとの集計を取得しない", async () => {
    let topicCalls = 0;
    useHandlers({ personas: [persona("p-1", "2026-07-27T00:00:00+09:00")] });
    server.use(
      http.get(`${API}/admin/persona/topics`, () => {
        topicCalls += 1;
        return HttpResponse.json({ topics: [] });
      }),
    );
    const { result } = renderHookWithQuery(() => useVoices());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(topicCalls).toBe(0);
  });

  it("絞り込みを変えるとサーバーに投げ直す", async () => {
    const calls = useHandlers({
      personas: [persona("p-1", "2026-07-27T00:00:00+09:00")],
    });
    const { result } = renderHookWithQuery(() => useVoices());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilter({
        ...result.current.filter,
        sents: ["positive"],
      });
    });

    await waitFor(() =>
      expect(calls.some((c) => c.get("sentiments") === "positive")).toBe(true),
    );
  });

  it("緊急だけを選んだらペルソナを取得しない", async () => {
    const calls = useHandlers({
      emergencies: [emergency("e-1", "2026-07-28T08:40:00+09:00")],
    });
    const { result } = renderHookWithQuery(() =>
      useVoices({ sents: ["emergency"] }),
    );

    await waitFor(() => expect(result.current.matchCount).toBe(1));
    expect(result.current.voices[0].id).toBe("e-1");
    expect(calls).toHaveLength(0);
  });
});

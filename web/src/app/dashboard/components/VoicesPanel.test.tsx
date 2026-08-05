import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { VoicesPanel } from "./VoicesPanel";

const API = "http://localhost:8787";

const personas = [
  {
    id: "p-1",
    category: "impression",
    tags: "そば",
    content: "音威子府そばがとても美味しかった",
    source: "chat",
    topic: "観光",
    sentiment: "positive",
    demographicSummary: "30代,観光客",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: null,
    conversationEndedAt: "2026-07-20T00:00:00Z",
  },
  {
    id: "p-2",
    category: "complaint",
    tags: "ゴミ分別",
    content: "粗大ごみの出し方がわかりにくい",
    source: "chat",
    topic: "生活",
    sentiment: "negative",
    demographicSummary: "40代,村人",
    createdAt: "2026-07-02T00:00:00Z",
    updatedAt: null,
    conversationEndedAt: "2026-07-25T00:00:00Z",
  },
];

const emergencies = [
  {
    id: "e-1",
    type: "熊の出没",
    description: "農道付近で子熊を目撃",
    location: "物満内",
    reportedAt: "2026-07-28T08:40:00Z",
    updatedAt: null,
  },
];

const usePersonaHandlers = () => {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/admin/persona`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.push(params);
      const sentiments = params.get("sentiments")?.split(",");
      const filtered = sentiments
        ? personas.filter((p) => sentiments.includes(p.sentiment))
        : personas;
      return HttpResponse.json({
        personas: filtered,
        total: filtered.length,
        nextCursor: null,
        hasMore: false,
      });
    }),
    http.get(`${API}/admin/persona/topics`, () =>
      HttpResponse.json({
        topics: [
          {
            topic: "観光",
            total: 1,
            sentiments: { positive: 1, negative: 0, request: 0, neutral: 0 },
            sample: "音威子府そばがとても美味しかった",
          },
          {
            topic: "生活",
            total: 1,
            sentiments: { positive: 0, negative: 1, request: 0, neutral: 0 },
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

describe("VoicesPanel", () => {
  it("ペルソナと緊急を新しい順に混ぜて表示し、該当件数を出す", async () => {
    usePersonaHandlers();
    renderWithQuery(<VoicesPanel />);

    await waitFor(() => {
      expect(screen.getByText(/熊の出没/)).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId("voice-card");
    expect(cards[0].textContent).toContain("熊の出没");
    expect(cards[1].textContent).toContain("粗大ごみ");
    expect(cards[2].textContent).toContain("そば");
    expect(within(cards[0]).getByText("緊急")).toBeInTheDocument();

    expect(screen.getByText("3件が該当")).toBeInTheDocument();
  });

  it("ポップオーバーでネガティブを選ぶとサーバーに絞り込みを投げる", async () => {
    const calls = usePersonaHandlers();
    renderWithQuery(<VoicesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/熊の出没/)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /絞り込む/ }));
    await user.click(screen.getByRole("button", { name: "ネガティブ" }));
    await user.click(screen.getByRole("button", { name: "この条件で見る" }));

    await waitFor(() => {
      expect(calls.some((c) => c.get("sentiments") === "negative")).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByText(/そばがとても美味しかった/)).toBeNull();
    });
    expect(screen.getByText("粗大ごみの出し方がわかりにくい")).toBeVisible();
    // 感情で絞ると緊急はストリームから外れる
    expect(screen.queryByText(/熊の出没/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "ネガティブ を解除" }),
    ).toBeInTheDocument();
  });

  it("チップの解除でフィルターが外れる", async () => {
    usePersonaHandlers();
    renderWithQuery(<VoicesPanel initialFilter={{ sents: ["negative"] }} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "ネガティブ を解除" }),
      ).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "ネガティブ を解除" }));

    await waitFor(() => {
      expect(screen.getByText(/熊の出没/)).toBeInTheDocument();
    });
  });

  it("0件のときは空状態メッセージを表示する", async () => {
    server.use(
      http.get(`${API}/admin/persona`, () =>
        HttpResponse.json({
          personas: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
        }),
      ),
      http.get(`${API}/admin/emergency`, () =>
        HttpResponse.json({ emergencies: [] }),
      ),
    );
    renderWithQuery(<VoicesPanel />);

    await waitFor(() => {
      expect(
        screen.getByText(/条件をゆるめてみてください/),
      ).toBeInTheDocument();
    });
  });

  it("話題ごと表示に切り替えるとサーバー集計のトピックカードが並ぶ", async () => {
    usePersonaHandlers();
    renderWithQuery(<VoicesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/熊の出没/)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "話題ごと" }));

    await waitFor(() => {
      expect(screen.getAllByTestId("topic-group").length).toBeGreaterThan(0);
    });
    const groups = screen.getAllByTestId("topic-group");
    expect(groups.some((g) => g.textContent?.includes("観光"))).toBe(true);
    expect(groups.some((g) => g.textContent?.includes("緊急"))).toBe(true);
  });

  it("話題カードをクリックすると一覧に切り替わり、その話題で絞られる", async () => {
    const calls = usePersonaHandlers();
    renderWithQuery(<VoicesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/熊の出没/)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "話題ごと" }));
    await waitFor(() => {
      expect(screen.getAllByTestId("topic-group").length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: /観光/ }));

    await waitFor(() => {
      expect(calls.some((c) => c.get("topic") === "観光")).toBe(true);
    });
    expect(screen.queryByTestId("topic-group")).toBeNull();
  });

  it("緊急の話題カードをクリックすると緊急だけの一覧に切り替わる", async () => {
    usePersonaHandlers();
    renderWithQuery(<VoicesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/熊の出没/)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "話題ごと" }));
    await waitFor(() => {
      expect(screen.getAllByTestId("topic-group").length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: /熊の出没/ }));

    await waitFor(() => {
      expect(screen.queryByTestId("topic-group")).toBeNull();
    });
    const cards = screen.getAllByTestId("voice-card");
    expect(cards.every((c) => c.textContent?.includes("緊急"))).toBe(true);
  });

  it("緊急だけを選ぶとペルソナを取得しない", async () => {
    const calls = usePersonaHandlers();
    renderWithQuery(<VoicesPanel initialFilter={{ sents: ["emergency"] }} />);

    await waitFor(() => {
      expect(screen.getByText(/熊の出没/)).toBeInTheDocument();
    });
    expect(calls).toHaveLength(0);
  });

  it("分析ボタンでフィルター文脈つきの onAskMayor が呼ばれる", async () => {
    usePersonaHandlers();
    const onAskMayor = vi.fn();
    renderWithQuery(
      <VoicesPanel
        initialFilter={{ sents: ["negative"] }}
        onAskMayor={onAskMayor}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /この1件の声を分析してもらう/ }),
      ).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /この1件の声を分析してもらう/ }),
    );
    expect(onAskMayor).toHaveBeenCalledWith("直近30日 × ネガティブ・1件");
  });

  it("すべて解除で初期状態に戻る", async () => {
    usePersonaHandlers();
    renderWithQuery(
      <VoicesPanel initialFilter={{ sents: ["negative"], topic: "生活" }} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /絞り込む（2）/ }),
      ).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /絞り込む/ }));
    await user.click(screen.getByRole("button", { name: "すべて解除" }));

    await waitFor(() => {
      expect(screen.getByText(/熊の出没/)).toBeInTheDocument();
    });
  });
});

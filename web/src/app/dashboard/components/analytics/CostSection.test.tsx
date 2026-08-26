import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { CostSection } from "./CostSection";

const API = "http://localhost:8787";

const operationCost = {
  totalCostUsd: 0.41,
  byCategory: [],
  byProvider: [],
  daily: [
    { date: "2026-08-24", costUsd: 0.217 },
    { date: "2026-08-25", costUsd: 0.193 },
  ],
};

const threadUsage = {
  summary: {
    threads: 14,
    messages: 29,
    conversationCostUsd: 0.4,
    avgCostPerMessageUsd: 0.014,
    avgCostPerThreadUsd: 0.029,
    byAgent: [
      { agent: "knowledge-reranker", totalTokens: 537_000, costUsd: 0.185 },
      { agent: "nepp-chan", totalTokens: 566_000, costUsd: 0.083 },
      { agent: null, totalTokens: 10_000, costUsd: 0.01 },
    ],
  },
  threads: [
    {
      threadId: "fe6eb2b6-thread-1",
      platform: "web",
      messageCount: 1,
      inputTokens: 10_000,
      outputTokens: 2_000,
      reasoningTokens: 0,
      cachedInputTokens: 6_000,
      totalTokens: 12_000,
      costUsd: 0.072,
      models: ["openai/gpt-5.6-luna"],
      agents: [],
      firstMessageAt: null,
      lastMessageAt: null,
      durationSeconds: null,
    },
    {
      threadId: "2bac70fd-thread-2",
      platform: "line",
      messageCount: 4,
      inputTokens: 4_000,
      outputTokens: 800,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      totalTokens: 4_800,
      costUsd: 0.029,
      models: [],
      agents: [],
      firstMessageAt: null,
      lastMessageAt: null,
      durationSeconds: null,
    },
  ],
};

type ThreadUsageBody = Omit<typeof threadUsage, "summary"> & {
  summary: Omit<
    typeof threadUsage.summary,
    "avgCostPerMessageUsd" | "avgCostPerThreadUsd"
  > & {
    avgCostPerMessageUsd: number | null;
    avgCostPerThreadUsd: number | null;
  };
};

const useHandlers = (
  operation: typeof operationCost = operationCost,
  usage: ThreadUsageBody = threadUsage,
) =>
  server.use(
    http.get(`${API}/admin/analytics/usage/operation`, () =>
      HttpResponse.json(operation),
    ),
    http.get(`${API}/admin/analytics/usage/threads`, () =>
      HttpResponse.json(usage),
    ),
  );

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("CostSection", () => {
  it("1 メッセージ平均・30 日合計・会話数を表示する", async () => {
    useHandlers();
    renderWithQuery(<CostSection />);

    expect(await screen.findByText("1 メッセージ平均")).toBeInTheDocument();
    // 0.014 USD × 150 = ¥2.1
    expect(screen.getByText("¥2.1")).toBeInTheDocument();
    expect(screen.getByText("¥61.5")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("エージェント別の内訳を金額つきで表示する", async () => {
    useHandlers();
    renderWithQuery(<CostSection />);

    expect(
      await screen.findByText("エージェント別のコスト"),
    ).toBeInTheDocument();
    expect(screen.getByText("リランク")).toBeInTheDocument();
    expect(screen.getByText("¥27.75")).toBeInTheDocument();
    expect(screen.queryByText("記録前")).toBeNull();
  });

  it("会話行にチャネルとメッセージ数を表示する", async () => {
    useHandlers();
    renderWithQuery(<CostSection />);

    expect(await screen.findByText(/fe6eb2b6/)).toBeInTheDocument();
    expect(screen.getByText("LINE")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("会話行をクリックすると往復ごとの内訳を開く", async () => {
    useHandlers();
    server.use(
      http.get(`${API}/admin/analytics/usage/threads/fe6eb2b6-thread-1`, () =>
        HttpResponse.json({
          turns: [
            {
              turnIndex: null,
              answeredAt: null,
              totalTokens: 1_000,
              costUsd: 0.01,
              durationMs: null,
              intent: null,
              agents: [
                {
                  agent: null,
                  totalTokens: 1_000,
                  costUsd: 0.01,
                },
              ],
            },
            {
              turnIndex: 1,
              answeredAt: "2026-08-25T08:24:00.000Z",
              totalTokens: 12_000,
              costUsd: 0.072,
              durationMs: 33_200,
              intent: "thinking",
              agents: [
                {
                  agent: "knowledge",
                  totalTokens: 9_000,
                  costUsd: 0.05,
                },
              ],
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(<CostSection />);

    await user.click(await screen.findByText(/fe6eb2b6/));

    expect(await screen.findByText("8/25 17:24")).toBeInTheDocument();
    expect(screen.getByText("33.2秒")).toBeInTheDocument();
    expect(screen.getByText("thinking")).toBeInTheDocument();
    expect(screen.getByText("ナレッジ検索")).toBeInTheDocument();
    expect(screen.getByText("¥7.5")).toBeInTheDocument();
    expect(screen.queryByText("記録前")).toBeNull();
  });

  it("記録が無ければ空状態を表示する", async () => {
    useHandlers(
      { totalCostUsd: 0, byCategory: [], byProvider: [], daily: [] },
      {
        summary: {
          threads: 0,
          messages: 0,
          conversationCostUsd: 0,
          avgCostPerMessageUsd: null,
          avgCostPerThreadUsd: null,
          byAgent: [],
        },
        threads: [],
      },
    );
    renderWithQuery(<CostSection />);

    expect(await screen.findByText("まだ記録がありません")).toBeInTheDocument();
  });
});

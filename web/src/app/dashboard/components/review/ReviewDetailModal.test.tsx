import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { ReviewDetailModal } from "./ReviewDetailModal";

const API = "http://localhost:8787";

const detail = (over: Record<string, unknown> = {}) => ({
  answerRunId: "ar-1",
  threadId: "thread-1",
  messageId: "msg-1",
  turnIndex: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  flags: { zeroHit: false, webFallback: true, badFeedback: true },
  runs: [
    {
      query: "村営バスの時刻",
      hits: [
        {
          source: "bus/index.md",
          section: "時刻表",
          score: 0.82,
          rerankScore: 0.9,
        },
      ],
      durationMs: 120,
      createdAt: "2026-09-01T00:00:00.000Z",
    },
    {
      query: "バス 休日",
      hits: [],
      durationMs: 90,
      createdAt: "2026-09-01T00:00:10.000Z",
    },
  ],
  conversation: { question: "バスは何時？", answer: "8時と17時だよ" },
  feedbacks: [
    {
      id: "fb-1",
      threadId: "thread-1",
      messageId: "msg-1",
      rating: "bad",
      category: null,
      comment: "時間が違う",
      conversationContext: {
        targetMessage: { id: "msg-1", role: "assistant", content: "x" },
        previousMessages: [],
        nextMessages: [],
      },
      toolExecutions: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      resolvedAt: null,
    },
  ],
  decisions: [],
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("ReviewDetailModal", () => {
  it("会話・根拠・評価を表示する", async () => {
    server.use(
      http.get(`${API}/admin/review/ar-1`, () => HttpResponse.json(detail())),
    );

    renderWithQuery(
      <ReviewDetailModal answerRunId="ar-1" onClose={() => {}} />,
    );

    expect(await screen.findByText("バスは何時？")).toBeInTheDocument();
    expect(screen.getByText("8時と17時だよ")).toBeInTheDocument();
    expect(screen.getByText("bus/index.md")).toBeInTheDocument();
    expect(screen.getByText("ヒットなし")).toBeInTheDocument();
    expect(screen.getByText("時間が違う")).toBeInTheDocument();
    expect(screen.getByText("Web補完")).toBeInTheDocument();
  });

  it("会話が取れない場合は案内を表示する", async () => {
    server.use(
      http.get(`${API}/admin/review/ar-1`, () =>
        HttpResponse.json(detail({ conversation: null })),
      ),
    );

    renderWithQuery(
      <ReviewDetailModal answerRunId="ar-1" onClose={() => {}} />,
    );

    expect(
      await screen.findByText("会話は保管期限切れなどで表示できません"),
    ).toBeInTheDocument();
  });

  it("判断ボタンで decision を POST する", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.get(`${API}/admin/review/ar-1`, () => HttpResponse.json(detail())),
      http.post(`${API}/admin/review/ar-1/decision`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          message: "ok",
          decision: {
            id: "dec-1",
            decision: "source_missing",
            comment: null,
            reviewedBy: "u-1",
            createdAt: "2026-09-01T00:00:00.000Z",
          },
        });
      }),
    );

    renderWithQuery(
      <ReviewDetailModal answerRunId="ar-1" onClose={() => {}} />,
    );

    await screen.findByText("バスは何時？");
    await userEvent.type(
      screen.getByPlaceholderText("メモ（任意）"),
      "公式サイト未収集",
    );
    await userEvent.click(screen.getByRole("button", { name: "情報源不足" }));

    expect(capturedBody).toEqual({
      decision: "source_missing",
      comment: "公式サイト未収集",
    });
  });

  it("判断履歴を表示する", async () => {
    server.use(
      http.get(`${API}/admin/review/ar-1`, () =>
        HttpResponse.json(
          detail({
            decisions: [
              {
                id: "dec-1",
                decision: "incorrect",
                comment: "時刻が古い",
                reviewedBy: "u-1",
                createdAt: "2026-09-02T00:00:00.000Z",
              },
            ],
          }),
        ),
      ),
    );

    renderWithQuery(
      <ReviewDetailModal answerRunId="ar-1" onClose={() => {}} />,
    );

    expect(await screen.findByText(/誤り — 時刻が古い/)).toBeInTheDocument();
  });

  it("参照したナレッジから訂正を発行できる", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.get(`${API}/admin/review/ar-1`, () => HttpResponse.json(detail())),
      http.post(`${API}/admin/corrections`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          message: "ok",
          correction: { id: "cor-1" },
        });
      }),
    );

    renderWithQuery(<ReviewDetailModal answerRunId="ar-1" onClose={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "訂正を作成する" }),
    );

    expect(
      screen.getByRole("combobox", { name: "訂正する情報源" }),
    ).toHaveValue("bus/index.md");

    await userEvent.type(
      screen.getByPlaceholderText(/正しい内容/),
      "土曜は運休です",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "訂正を発行する" }),
    );

    await waitFor(() =>
      expect(capturedBody).toEqual({
        correctsSourcePath: "bus/index.md",
        body: "土曜は運休です",
        answerRunId: "ar-1",
      }),
    );
    expect(await screen.findByText(/訂正を発行しました/)).toBeInTheDocument();
  });
});

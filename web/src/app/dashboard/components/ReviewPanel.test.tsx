import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { ReviewPanel } from "./ReviewPanel";

const API = "http://localhost:8787";

const queueItem = (over: Record<string, unknown> = {}) => ({
  answerRunId: "ar-1",
  threadId: "thread-1",
  messageId: "msg-1",
  turnIndex: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  searchCount: 2,
  queries: ["村営バスの時刻", "バス 時刻表"],
  flags: { zeroHit: true, webFallback: false, badFeedback: true },
  decision: null,
  decidedAt: null,
  ...over,
});

beforeEach(() => {
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
  localStorage.clear();
});

describe("ReviewPanel", () => {
  it("要確認一覧をシグナルバッジ付きで表示する", async () => {
    server.use(
      http.get(`${API}/admin/review`, () =>
        HttpResponse.json({
          items: [queueItem()],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    );

    renderWithQuery(<ReviewPanel />);

    expect(await screen.findByText("村営バスの時刻")).toBeInTheDocument();
    expect(screen.getByText("Bad評価")).toBeInTheDocument();
    expect(screen.getByText("検索0件")).toBeInTheDocument();
    expect(screen.getAllByText("未判断").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("他 1 回の検索")).toBeInTheDocument();
  });

  it("初期表示は decided=false で取得する", async () => {
    let capturedDecided: string | null = null;
    server.use(
      http.get(`${API}/admin/review`, ({ request }) => {
        capturedDecided = new URL(request.url).searchParams.get("decided");
        return HttpResponse.json({
          items: [],
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    renderWithQuery(<ReviewPanel />);

    await screen.findByText("要確認の回答はありません");
    expect(capturedDecided).toBe("false");
  });

  it("フィルタ切替で decided パラメータが変わる", async () => {
    const captured: Array<string | null> = [];
    server.use(
      http.get(`${API}/admin/review`, ({ request }) => {
        captured.push(new URL(request.url).searchParams.get("decided"));
        return HttpResponse.json({
          items: [],
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    renderWithQuery(<ReviewPanel />);
    await screen.findByText("要確認の回答はありません");

    await userEvent.click(screen.getByRole("button", { name: "判断済み" }));
    await waitFor(() => expect(captured).toContain("true"));
  });

  it("判断済みの行はラベルを表示する", async () => {
    server.use(
      http.get(`${API}/admin/review`, () =>
        HttpResponse.json({
          items: [
            queueItem({
              decision: "incorrect",
              decidedAt: "2026-09-02T00:00:00.000Z",
            }),
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    );

    renderWithQuery(<ReviewPanel />);
    expect(await screen.findByText("誤り")).toBeInTheDocument();
  });
  it("取得に失敗したらエラーを表示する", async () => {
    server.use(
      http.get(`${API}/admin/review`, () =>
        HttpResponse.json(
          { error: { code: 500, message: "一覧の取得に失敗しました" } },
          { status: 500 },
        ),
      ),
    );

    renderWithQuery(<ReviewPanel />);

    expect(
      await screen.findByText(/一覧の取得に失敗しました/),
    ).toBeInTheDocument();
  });

  it("詳細を開いて閉じられる", async () => {
    server.use(
      http.get(`${API}/admin/review`, () =>
        HttpResponse.json({
          items: [queueItem()],
          nextCursor: null,
          hasMore: false,
        }),
      ),
      http.get(`${API}/admin/review/ar-1`, () =>
        HttpResponse.json({
          answerRunId: "ar-1",
          threadId: "thread-1",
          messageId: "msg-1",
          turnIndex: 1,
          createdAt: "2026-09-01T00:00:00.000Z",
          flags: { zeroHit: true, webFallback: false, badFeedback: true },
          runs: [],
          conversation: { question: "村営バスの時刻は？", answer: "9時です" },
          archivedEvidence: null,
          feedbacks: [],
          decisions: [],
        }),
      ),
    );

    renderWithQuery(<ReviewPanel />);
    await screen.findByText("村営バスの時刻");

    await userEvent.click(screen.getByRole("button", { name: "詳細" }));
    expect(await screen.findByText("村営バスの時刻は？")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
    await waitFor(() =>
      expect(screen.queryByText("村営バスの時刻は？")).not.toBeInTheDocument(),
    );
  });
});

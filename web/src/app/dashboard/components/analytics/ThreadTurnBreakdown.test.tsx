import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { ThreadTurnBreakdown } from "./ThreadTurnBreakdown";

const API = "http://localhost:8787";
const THREAD_ID = "thread-1";

const turn = (turnId: string | null, answeredAt: string | null) => ({
  turnId,
  answeredAt,
  totalTokens: 1_000,
  costUsd: 0.01,
  durationMs: 1_000,
  intent: "casual",
  agents: [{ agent: "nepp-chan", totalTokens: 1_000, costUsd: 0.01 }],
});

const useTurns = (turns: ReturnType<typeof turn>[]) =>
  server.use(
    http.get(`${API}/admin/analytics/usage/threads/${THREAD_ID}`, () =>
      HttpResponse.json({ turns }),
    ),
  );

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("ThreadTurnBreakdown", () => {
  it("turn_id 記録前の行は表示しない", async () => {
    useTurns([turn(null, null), turn("turn-1", "2026-08-25T08:24:00.000Z")]);

    renderWithQuery(<ThreadTurnBreakdown threadId={THREAD_ID} />);

    expect(await screen.findByText("8/25 17:24")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("表示できるターンが無ければ記録なしと伝える", async () => {
    useTurns([turn(null, null)]);

    renderWithQuery(<ThreadTurnBreakdown threadId={THREAD_ID} />);

    expect(
      await screen.findByText("メッセージ単位の記録がありません"),
    ).toBeInTheDocument();
  });
});

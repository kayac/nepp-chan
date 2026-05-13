import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";

const searchParams = vi.fn<() => URLSearchParams>(() => new URLSearchParams());
vi.mock("~/lib/redirect", () => ({
  getCurrentSearchParams: () => searchParams(),
  redirectTo: vi.fn(),
}));

const { PollResultsInner } = await import("./PollResultsPage");

const API = "http://localhost:8787";

beforeEach(() => {
  searchParams.mockReset();
  searchParams.mockReturnValue(new URLSearchParams());
});

afterEach(() => {
  searchParams.mockReset();
});

describe("PollResultsPage", () => {
  it("id クエリが無いとガイドメッセージを表示する", () => {
    renderWithQuery(<PollResultsInner />);
    expect(screen.getByText("投票IDが指定されていません")).toBeDefined();
  });

  it("ネットワークエラーなら表示不可メッセージを出す", async () => {
    searchParams.mockReturnValue(new URLSearchParams("id=missing"));
    server.use(http.get(`${API}/polls/missing`, () => HttpResponse.error()));

    renderWithQuery(<PollResultsInner />);

    await waitFor(() => {
      expect(screen.getByText("投票結果を表示できません")).toBeDefined();
    });
  });

  it("submissions が 0 件なら『まだ投票がありません』を表示する", async () => {
    searchParams.mockReturnValue(new URLSearchParams("id=p-1"));
    server.use(
      http.get(`${API}/polls/p-1`, () =>
        HttpResponse.json({
          id: "p-1",
          title: "夕食は？",
          totalSubmissions: 0,
          choiceResults: [],
        }),
      ),
    );

    renderWithQuery(<PollResultsInner />);

    await waitFor(() => {
      expect(screen.getByText("夕食は？")).toBeDefined();
      expect(screen.getByText("まだ投票がありません")).toBeDefined();
    });
  });

  it("結果が揃えば title / 件数 / 各 choice を描画する", async () => {
    searchParams.mockReturnValue(new URLSearchParams("id=p-2"));
    server.use(
      http.get(`${API}/polls/p-2`, () =>
        HttpResponse.json({
          id: "p-2",
          title: "朝ごはんは？",
          totalSubmissions: 5,
          choiceResults: [
            { choice: "ごはん", count: 3 },
            { choice: "パン", count: 2 },
          ],
        }),
      ),
    );

    renderWithQuery(<PollResultsInner />);

    await waitFor(() => {
      expect(screen.getByText("朝ごはんは？")).toBeDefined();
      expect(screen.getByText("5人が参加")).toBeDefined();
      expect(screen.getByText("ごはん")).toBeDefined();
      expect(screen.getByText("パン")).toBeDefined();
    });
  });
});

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { UsagePanel } from "./UsagePanel";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

const dailyUsage = {
  daily: [
    {
      date: "2026-06-01",
      model: "gemini-2.5-flash",
      inputTokens: 1000,
      outputTokens: 500,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      totalTokens: 1500,
      costUsd: 0.1,
    },
    {
      date: "2026-06-02",
      model: "gemini-2.5-flash",
      inputTokens: 2000,
      outputTokens: 1000,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      totalTokens: 3000,
      costUsd: 0.2,
    },
  ],
};

describe("UsagePanel", () => {
  it("日ごとの合計を円表記で新しい順に表示する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/usage`, () =>
        HttpResponse.json(dailyUsage),
      ),
    );

    renderWithQuery(<UsagePanel />);

    await screen.findByText(/2026-06-02/);

    const dates = screen
      .getAllByText(/2026-06-0[12]/)
      .map((el) => el.textContent?.trim());
    expect(dates).toEqual(["▸ 2026-06-02", "▸ 2026-06-01"]);
    expect(screen.getByText("¥45")).toBeInTheDocument();
  });

  it("日付の行を開くとモデル内訳を表示する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/usage`, () =>
        HttpResponse.json(dailyUsage),
      ),
    );

    renderWithQuery(<UsagePanel />);

    const row = await screen.findByText(/2026-06-02/);
    expect(screen.queryByText("入力")).not.toBeInTheDocument();

    await userEvent.click(row);

    expect(screen.getByText("入力")).toBeInTheDocument();
    expect(screen.getByText("2,000")).toBeInTheDocument();
  });

  it("データが空のときは案内文を表示する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/usage`, () =>
        HttpResponse.json({ daily: [] }),
      ),
    );

    renderWithQuery(<UsagePanel />);

    await waitFor(() => {
      expect(screen.getByText(/まだ記録がありません/)).toBeInTheDocument();
    });
  });
});

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const usageRow = (params: {
  date: string;
  inputTokens: number;
  costUsd: number;
  model?: string;
}) => ({
  date: params.date,
  model: params.model ?? "gemini-2.5-flash",
  inputTokens: params.inputTokens,
  outputTokens: params.inputTokens / 2,
  reasoningTokens: 0,
  cachedInputTokens: 0,
  totalTokens: params.inputTokens * 1.5,
  costUsd: params.costUsd,
});

const dailyUsage = {
  daily: [
    usageRow({ date: "2026-05-31", inputTokens: 400, costUsd: 0.4 }),
    usageRow({ date: "2026-06-01", inputTokens: 1000, costUsd: 0.1 }),
    usageRow({ date: "2026-06-02", inputTokens: 2000, costUsd: 0.2 }),
  ],
};

const serveUsage = () =>
  server.use(
    http.get(`${API}/admin/analytics/usage`, () =>
      HttpResponse.json(dailyUsage),
    ),
  );

describe("UsagePanel", () => {
  it("月ごとの合計を円表記で新しい順に表示する", async () => {
    serveUsage();

    renderWithQuery(<UsagePanel />);

    await screen.findByText(/2026-06/);

    const months = screen
      .getAllByText(/^[▸▾] 2026-0[56]$/)
      .map((el) => el.textContent?.trim());
    expect(months).toEqual(["▸ 2026-06", "▸ 2026-05"]);
    expect(
      screen.getByText(/^▸ 2026-06$/).closest("tr")?.textContent,
    ).toContain("¥45");
    expect(
      screen.getByText(/^▸ 2026-05$/).closest("tr")?.textContent,
    ).toContain("¥60");
  });

  it("月を開くと日別行が出て、日を開くとモデル内訳を表示する", async () => {
    serveUsage();

    renderWithQuery(<UsagePanel />);

    const monthRow = await screen.findByText(/^▸ 2026-06$/);
    expect(screen.queryByText(/2026-06-02/)).not.toBeInTheDocument();

    await userEvent.click(monthRow);

    const dates = screen
      .getAllByText(/2026-06-0[12]/)
      .map((el) => el.textContent?.trim());
    expect(dates).toEqual(["▸ 2026-06-02", "▸ 2026-06-01"]);
    expect(screen.queryByText("入力")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(/2026-06-02/));

    expect(screen.getByText("入力")).toBeInTheDocument();
    expect(screen.getByText("2,000")).toBeInTheDocument();
  });

  it("今月と先月の合計を並べ、今月の行は最初から開いておく", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    serveUsage();

    renderWithQuery(<UsagePanel />);

    await screen.findByText(/^▾ 2026-06$/);

    expect(screen.getByText("今月").parentElement?.textContent).toContain(
      "¥45",
    );
    expect(screen.getByText("先月").parentElement?.textContent).toContain(
      "¥60",
    );
    expect(screen.getByText(/2026-06-02/)).toBeInTheDocument();

    vi.useRealTimers();
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

import { screen, waitFor } from "@testing-library/react";
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

describe("UsagePanel", () => {
  it("週×モデル別のトークン量とコストを表示する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/usage`, () =>
        HttpResponse.json({
          weekly: [
            {
              weekStart: "2026-06-01",
              model: "gemini-2.5-flash",
              inputTokens: 1000,
              outputTokens: 500,
              reasoningTokens: 0,
              cachedInputTokens: 0,
              totalTokens: 1500,
              costUsd: 0.0015,
            },
          ],
        }),
      ),
    );

    renderWithQuery(<UsagePanel />);

    await waitFor(() => {
      expect(screen.getByText("トークン消費・コスト")).toBeInTheDocument();
      expect(screen.getAllByText(/gemini-2.5-flash/).length).toBeGreaterThan(
        0,
      );
    });
  });

  it("データが空のときは案内文を表示する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/usage`, () =>
        HttpResponse.json({ weekly: [] }),
      ),
    );

    renderWithQuery(<UsagePanel />);

    await waitFor(() => {
      expect(screen.getByText(/まだ記録がありません/)).toBeInTheDocument();
    });
  });
});

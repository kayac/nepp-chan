import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { ResultsModal } from "./ResultsModal";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("ResultsModal", () => {
  it("ヘッダーと閉じるボタンを描画", () => {
    server.use(
      http.get(`${API}/admin/polls/p-1/results`, () =>
        HttpResponse.json({
          pollId: "p-1",
          title: "Q",
          totalSubmissions: 0,
          choiceResults: [],
        }),
      ),
    );
    renderWithQuery(<ResultsModal pollId="p-1" onClose={vi.fn()} />);
    expect(screen.getByText("投票結果")).toBeInTheDocument();
  });

  it("results が読み込まれるとタイトルと参加者数を表示", async () => {
    server.use(
      http.get(`${API}/admin/polls/p-1/results`, () =>
        HttpResponse.json({
          pollId: "p-1",
          title: "好きな色",
          totalSubmissions: 12,
          choiceResults: [
            { choice: "赤", count: 7, percentage: 58 },
            { choice: "青", count: 5, percentage: 42 },
          ],
        }),
      ),
    );

    renderWithQuery(<ResultsModal pollId="p-1" onClose={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("好きな色")).toBeInTheDocument(),
    );
    expect(screen.getByText("12人が参加")).toBeInTheDocument();
    expect(screen.getByText("赤")).toBeInTheDocument();
    expect(screen.getByText("7票（58%）")).toBeInTheDocument();
  });

  it("閉じるボタンで onClose 呼び出し", () => {
    server.use(
      http.get(`${API}/admin/polls/p-1/results`, () =>
        HttpResponse.json({
          pollId: "p-1",
          title: "Q",
          totalSubmissions: 0,
          choiceResults: [],
        }),
      ),
    );
    const onClose = vi.fn();
    renderWithQuery(<ResultsModal pollId="p-1" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalled();
  });
});

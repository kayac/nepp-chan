import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { CorrectionsPanel } from "./CorrectionsPanel";

const API = "http://localhost:8787";

const correction = (over: Record<string, unknown> = {}) => ({
  id: "cor-1",
  correctsSourcePath: "bus/index.md",
  body: "土曜は運休です",
  status: "published",
  verifiedAt: "2026-09-01",
  approvedBy: "user-1",
  relatedFeedbackId: null,
  answerRunId: null,
  needsReviewAt: null,
  needsReviewReason: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: null,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("CorrectionsPanel", () => {
  it("公開中の訂正を一覧表示する", async () => {
    server.use(
      http.get(`${API}/admin/corrections`, () =>
        HttpResponse.json({ corrections: [correction()] }),
      ),
    );

    renderWithQuery(<CorrectionsPanel />);

    expect(await screen.findByText("土曜は運休です")).toBeInTheDocument();
    expect(screen.getByText("bus/index.md")).toBeInTheDocument();
    expect(screen.getByText("廃止する")).toBeInTheDocument();
  });

  it("要再確認の訂正にはバッジと維持ボタンを表示する", async () => {
    server.use(
      http.get(`${API}/admin/corrections`, () =>
        HttpResponse.json({
          corrections: [
            correction({
              needsReviewAt: "2026-09-02T00:00:00.000Z",
              needsReviewReason: "source_updated",
            }),
          ],
        }),
      ),
    );

    renderWithQuery(<CorrectionsPanel />);

    expect(
      await screen.findByText("要再確認（元ページが更新されました）"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "内容を確認した（維持する）" }),
    ).toBeInTheDocument();
  });

  it("元の情報源が外れた訂正は理由を区別して表示する", async () => {
    server.use(
      http.get(`${API}/admin/corrections`, () =>
        HttpResponse.json({
          corrections: [
            correction({
              needsReviewAt: "2026-09-02T00:00:00.000Z",
              needsReviewReason: "source_unavailable",
            }),
          ],
        }),
      ),
    );

    renderWithQuery(<CorrectionsPanel />);

    expect(
      await screen.findByText("要再確認（元の情報源が検索対象から外れました）"),
    ).toBeInTheDocument();
  });

  it("フィルタで廃止済みだけを表示できる", async () => {
    server.use(
      http.get(`${API}/admin/corrections`, () =>
        HttpResponse.json({
          corrections: [
            correction(),
            correction({ id: "cor-2", status: "retired", body: "旧訂正" }),
          ],
        }),
      ),
    );

    renderWithQuery(<CorrectionsPanel />);
    await screen.findByText("土曜は運休です");

    await userEvent.click(screen.getByRole("button", { name: "廃止済み" }));

    expect(screen.getByText("旧訂正")).toBeInTheDocument();
    expect(screen.queryByText("土曜は運休です")).not.toBeInTheDocument();
  });

  it("廃止は確認ダイアログを経て POST する", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    let retired = false;
    server.use(
      http.get(`${API}/admin/corrections`, () =>
        HttpResponse.json({ corrections: [correction()] }),
      ),
      http.post(`${API}/admin/corrections/cor-1/retire`, () => {
        retired = true;
        return HttpResponse.json({
          message: "ok",
          correction: correction({ status: "retired" }),
        });
      }),
    );

    renderWithQuery(<CorrectionsPanel />);
    await screen.findByText("土曜は運休です");

    await userEvent.click(screen.getByRole("button", { name: "廃止する" }));
    await waitFor(() => expect(retired).toBe(true));
  });
});

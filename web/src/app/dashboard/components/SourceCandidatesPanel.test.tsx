import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { SourceCandidatesPanel } from "./SourceCandidatesPanel";

const API = "http://localhost:8787";

const candidate = (over: Record<string, unknown> = {}) => ({
  id: "cand-1",
  url: "https://vill.example.jp/garbage",
  status: "pending",
  occurrenceCount: 3,
  relatedAnswerRunId: "ar-1",
  decidedBy: null,
  decidedAt: null,
  lastSeenAt: "2026-09-01T00:00:00.000Z",
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
});

describe("SourceCandidatesPanel", () => {
  it("未判断の候補と参照回数を表示する", async () => {
    server.use(
      http.get(`${API}/admin/source-candidates`, () =>
        HttpResponse.json({ candidates: [candidate()] }),
      ),
    );

    renderWithQuery(<SourceCandidatesPanel />);

    expect(
      await screen.findByText("https://vill.example.jp/garbage"),
    ).toBeInTheDocument();
    expect(screen.getByText(/参照 3 回/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "収集対象として承認" }),
    ).toBeInTheDocument();
  });

  it("承認で PATCH を送る", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.get(`${API}/admin/source-candidates`, () =>
        HttpResponse.json({ candidates: [candidate()] }),
      ),
      http.patch(
        `${API}/admin/source-candidates/cand-1/status`,
        async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            message: "ok",
            candidate: candidate({ status: "approved" }),
          });
        },
      ),
    );

    renderWithQuery(<SourceCandidatesPanel />);
    await screen.findByText("https://vill.example.jp/garbage");

    await userEvent.click(
      screen.getByRole("button", { name: "収集対象として承認" }),
    );
    await waitFor(() => expect(capturedBody).toEqual({ action: "approve" }));
  });

  it("フィルタで承認済みだけを表示できる", async () => {
    server.use(
      http.get(`${API}/admin/source-candidates`, () =>
        HttpResponse.json({
          candidates: [
            candidate(),
            candidate({
              id: "cand-2",
              url: "https://vill.example.jp/bus",
              status: "approved",
            }),
          ],
        }),
      ),
    );

    renderWithQuery(<SourceCandidatesPanel />);
    await screen.findByText("https://vill.example.jp/garbage");

    await userEvent.click(screen.getByRole("button", { name: "承認済み" }));

    expect(screen.getByText("https://vill.example.jp/bus")).toBeInTheDocument();
    expect(
      screen.queryByText("https://vill.example.jp/garbage"),
    ).not.toBeInTheDocument();
  });

  it("取得に失敗したらエラーを表示する", async () => {
    server.use(
      http.get(`${API}/admin/source-candidates`, () =>
        HttpResponse.json(
          { error: { code: 500, message: "候補の取得に失敗しました" } },
          { status: 500 },
        ),
      ),
    );

    renderWithQuery(<SourceCandidatesPanel />);

    expect(
      await screen.findByText(/候補の取得に失敗しました/),
    ).toBeInTheDocument();
  });

  it("却下で PATCH を送る", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.get(`${API}/admin/source-candidates`, () =>
        HttpResponse.json({ candidates: [candidate()] }),
      ),
      http.patch(
        `${API}/admin/source-candidates/cand-1/status`,
        async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            message: "ok",
            candidate: candidate({ status: "rejected" }),
          });
        },
      ),
    );

    renderWithQuery(<SourceCandidatesPanel />);
    await screen.findByText("https://vill.example.jp/garbage");

    await userEvent.click(screen.getByRole("button", { name: "却下" }));
    await waitFor(() => expect(capturedBody).toEqual({ action: "reject" }));
  });

  it("判断に失敗したらエラーを表示する", async () => {
    server.use(
      http.get(`${API}/admin/source-candidates`, () =>
        HttpResponse.json({ candidates: [candidate()] }),
      ),
      http.patch(`${API}/admin/source-candidates/cand-1/status`, () =>
        HttpResponse.json(
          { error: { code: 500, message: "判断の保存に失敗しました" } },
          { status: 500 },
        ),
      ),
    );

    renderWithQuery(<SourceCandidatesPanel />);
    await screen.findByText("https://vill.example.jp/garbage");

    await userEvent.click(
      screen.getByRole("button", { name: "収集対象として承認" }),
    );

    expect(
      await screen.findByText(/判断の保存に失敗しました/),
    ).toBeInTheDocument();
  });
});

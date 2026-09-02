import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { SourcesPanel } from "./SourcesPanel";

const API = "http://localhost:8787";

const source = (over: Record<string, unknown> = {}) => ({
  sourcePath: "garbage/index.md",
  canonicalUrl: "https://vill.example.jp/garbage",
  sourceType: null,
  sourceAuthority: null,
  approvalStatus: "pending",
  chunkCount: 4,
  approvedBy: null,
  approvedAt: null,
  disabledAt: null,
  verifiedAt: null,
  indexedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: null,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("SourcesPanel", () => {
  it("未承認の情報源に承認と却下のボタンを出す", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/sources`, () =>
        HttpResponse.json({ sources: [source()] }),
      ),
    );

    renderWithQuery(<SourcesPanel />);

    expect(await screen.findByText("garbage/index.md")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "承認して検索対象にする" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "却下する" }),
    ).toBeInTheDocument();
  });

  it("公開中の情報源は停止だけを選べる", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/sources`, () =>
        HttpResponse.json({
          sources: [source({ approvalStatus: "approved" })],
        }),
      ),
    );

    renderWithQuery(<SourcesPanel />);

    await userEvent.click(
      await screen.findByRole("button", { name: "公開中" }),
    );

    expect(
      await screen.findByRole("button", { name: "検索対象から外す" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "承認して検索対象にする" }),
    ).not.toBeInTheDocument();
  });

  it("承認で PATCH を送る", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.get(`${API}/admin/knowledge/sources`, () =>
        HttpResponse.json({ sources: [source()] }),
      ),
      http.patch(
        `${API}/admin/knowledge/sources/status`,
        async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            message: "ok",
            source: source({ approvalStatus: "approved" }),
          });
        },
      ),
    );

    renderWithQuery(<SourcesPanel />);

    await userEvent.click(
      await screen.findByRole("button", { name: "承認して検索対象にする" }),
    );

    await waitFor(() =>
      expect(capturedBody).toEqual({
        sourcePath: "garbage/index.md",
        action: "approve",
      }),
    );
  });

  it("確認をキャンセルしたら送信しない", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    let called = false;
    server.use(
      http.get(`${API}/admin/knowledge/sources`, () =>
        HttpResponse.json({ sources: [source()] }),
      ),
      http.patch(`${API}/admin/knowledge/sources/status`, () => {
        called = true;
        return HttpResponse.json({ message: "ok", source: source() });
      }),
    );

    renderWithQuery(<SourcesPanel />);

    await userEvent.click(
      await screen.findByRole("button", { name: "却下する" }),
    );

    expect(called).toBe(false);
  });

  it("エラー時はエラーを表示する", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/sources`, () =>
        HttpResponse.json(
          { error: { code: 500, message: "取得に失敗しました" } },
          { status: 500 },
        ),
      ),
    );

    renderWithQuery(<SourcesPanel />);

    expect(await screen.findByText(/^エラー:/)).toBeInTheDocument();
  });

  it("パスを検索で絞り込める", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/sources`, () =>
        HttpResponse.json({
          sources: [
            source(),
            source({ sourcePath: "bus/index.md", canonicalUrl: null }),
          ],
        }),
      ),
    );

    renderWithQuery(<SourcesPanel />);
    await screen.findByText("garbage/index.md");

    await userEvent.type(
      screen.getByRole("searchbox", { name: "情報源を検索" }),
      "bus",
    );

    expect(screen.getByText("bus/index.md")).toBeInTheDocument();
    expect(screen.queryByText("garbage/index.md")).not.toBeInTheDocument();
  });
});

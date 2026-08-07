import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { API_BASE } from "~/lib/api/client";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";

import { ToolFallback } from "./ToolFallback";

const asAdmin = () => {
  localStorage.setItem("auth_token", "admin-token");
  server.use(
    http.get(`${API_BASE}/auth/me`, () =>
      HttpResponse.json({
        user: { id: "u1", username: "admin", role: "admin" },
      }),
    ),
  );
};

const renderFallback = (overrides: {
  toolName?: string;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用
  args?: any;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用
  result?: any;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用
  status?: any;
}) => {
  const Comp = ToolFallback as unknown as (props: {
    toolName: string;
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    args?: any;
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    result?: any;
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    status?: any;
  }) => React.ReactElement;
  return renderWithQuery(
    <Comp
      toolName={overrides.toolName ?? "knowledge-search"}
      args={overrides.args ?? {}}
      result={overrides.result}
      status={overrides.status}
    />,
  );
};

describe("ToolFallback", () => {
  afterEach(() => localStorage.clear());

  it("running 状態は『調査中』ラベル + 実行中バッジ", () => {
    renderFallback({ status: { type: "running" } });
    expect(screen.getByText("ねっぷちゃんが調査中")).toBeDefined();
  });

  it("emergencyReportTool は『報告』表記", () => {
    renderFallback({
      toolName: "emergencyReportTool",
      status: { type: "complete" },
    });
    expect(screen.getByText("ねっぷちゃんが報告しました")).toBeDefined();
  });

  it("updateWorkingMemory は『記憶』表記", () => {
    renderFallback({
      toolName: "updateWorkingMemory",
      status: { type: "running" },
    });
    expect(screen.getByText("ねっぷちゃんが記憶中")).toBeDefined();
  });

  it("一般ユーザーには詳細の開閉ボタンを出さない", () => {
    renderFallback({
      args: { query: "x" },
      result: { ok: true },
      status: { type: "complete" },
    });

    expect(screen.queryByRole("button", { name: "詳細を表示" })).toBeNull();
    expect(screen.queryByText(/"query": "x"/)).toBeNull();
  });

  it("管理者は展開ボタンで入力パラメータ / result を表示できる", async () => {
    asAdmin();
    renderFallback({
      args: { query: "x" },
      result: { ok: true },
      status: { type: "complete" },
    });

    const toggle = await screen.findByRole("button", { name: "詳細を表示" });
    fireEvent.click(toggle);

    expect(screen.getByText(/"query": "x"/)).toBeDefined();
    expect(screen.getByText(/"ok": true/)).toBeDefined();
  });

  it("管理者は error 状態で『エラー詳細』を展開できる", async () => {
    asAdmin();
    renderFallback({
      status: { type: "incomplete", reason: "error", error: "boom" },
    });

    fireEvent.click(await screen.findByRole("button", { name: "詳細を表示" }));

    expect(screen.getByText("エラー詳細")).toBeDefined();
    expect(screen.getByText("boom")).toBeDefined();
  });

  it("一般ユーザーでもエラーの発生自体はバッジで分かる", async () => {
    renderFallback({
      status: { type: "incomplete", reason: "error", error: "boom" },
    });

    expect(screen.getByText("エラー")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText("boom")).toBeNull();
    });
  });
});

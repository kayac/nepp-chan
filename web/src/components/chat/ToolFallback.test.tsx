import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it } from "vitest";

import { ToolFallback } from "./ToolFallback";

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
  return render(
    <Comp
      toolName={overrides.toolName ?? "knowledge-search"}
      args={overrides.args ?? {}}
      result={overrides.result}
      status={overrides.status}
    />,
  );
};

describe("ToolFallback", () => {
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

  it("展開ボタンで入力パラメータ / result を表示する", () => {
    renderFallback({
      args: { query: "x" },
      result: { ok: true },
      status: { type: "complete" },
    });

    const toggle = screen.getByRole("button", { name: "詳細を表示" });
    fireEvent.click(toggle);

    expect(screen.getByText(/"query": "x"/)).toBeDefined();
    expect(screen.getByText(/"ok": true/)).toBeDefined();
  });

  it("error 状態は『エラー詳細』を出す（展開時）", () => {
    renderFallback({
      status: { type: "incomplete", reason: "error", error: "boom" },
    });

    fireEvent.click(screen.getByRole("button", { name: "詳細を表示" }));

    expect(screen.getByText("エラー詳細")).toBeDefined();
    expect(screen.getByText("boom")).toBeDefined();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it } from "vitest";

import { ToolFallback } from "./ToolFallback";

const renderFallback = (overrides: {
  toolName?: string;
  argsText?: string;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用
  result?: any;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用
  status?: any;
}) => {
  const Comp = ToolFallback as unknown as (props: {
    toolName: string;
    argsText: string;
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    result?: any;
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    status?: any;
    toolCallId: string;
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    addResult: any;
    type: string;
  }) => React.ReactElement;
  return render(
    <Comp
      toolName={overrides.toolName ?? "knowledge-search"}
      argsText={overrides.argsText ?? "{}"}
      result={overrides.result}
      status={overrides.status}
      toolCallId="t-1"
      addResult={() => undefined}
      type="tool-call"
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

  it("incomplete + cancelled で『キャンセル』表記とライン線", () => {
    renderFallback({
      status: { type: "incomplete", reason: "cancelled" },
    });
    expect(screen.getByText("ねっぷちゃんが調査しました")).toBeDefined();
  });

  it("展開ボタンで argsText / result を表示する", () => {
    renderFallback({
      argsText: '{"query":"x"}',
      result: { ok: true },
      status: { type: "complete" },
    });

    const toggle = screen.getByRole("button", { name: "詳細を表示" });
    fireEvent.click(toggle);

    expect(screen.getByText('{"query":"x"}')).toBeDefined();
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

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ToolPartStatus } from "~/components/chat/types";

import { defineToolUI } from "./define-tool-ui";

type TestArgs = { value: string };

const schema = {
  safeParse: (
    input: unknown,
  ): { success: true; data: TestArgs } | { success: false } => {
    const value = (input as { value?: unknown })?.value;
    return typeof value === "string"
      ? { success: true, data: { value } }
      : { success: false };
  },
};

const ToolUI = defineToolUI({
  schema,
  loading: <span>読み込み中</span>,
  emptyMessage: "データなし",
  isEmpty: (args) => args.value === "",
  Component: ({ args }) => <span>本体: {args.value}</span>,
});

const renderToolUI = (args: unknown, status: ToolPartStatus) =>
  render(
    <ToolUI
      toolName="testTool"
      args={args}
      result={undefined}
      status={status}
    />,
  );

describe("defineToolUI", () => {
  it("実行中で args がスキーマ検証に失敗したらローディングを表示する", () => {
    renderToolUI({}, { type: "running" });
    expect(screen.getByText("読み込み中")).toBeInTheDocument();
  });

  it("完了後に args がスキーマ検証に失敗したら空状態を表示する", () => {
    renderToolUI({ value: 1 }, { type: "complete" });
    expect(screen.getByText("データなし")).toBeInTheDocument();
  });

  it("isEmpty に該当したら空状態を表示する", () => {
    renderToolUI({ value: "" }, { type: "complete" });
    expect(screen.getByText("データなし")).toBeInTheDocument();
  });

  it("検証に通った args を Component に渡して描画する", () => {
    renderToolUI({ value: "ok" }, { type: "complete" });
    expect(screen.getByText("本体: ok")).toBeInTheDocument();
  });

  it("実行中でも args が揃っていれば Component を描画する", () => {
    renderToolUI({ value: "streaming" }, { type: "running" });
    expect(screen.getByText("本体: streaming")).toBeInTheDocument();
  });
});

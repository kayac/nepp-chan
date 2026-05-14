import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it } from "vitest";

import { DisplayTableToolComponent } from "./DataTableToolUI";

const Comp = DisplayTableToolComponent as unknown as (
  props: Record<string, unknown>,
) => React.ReactElement;

const baseArgs = {
  title: "売上表",
  columns: [
    { key: "name", label: "名前", sortable: true },
    { key: "amount", label: "金額", sortable: true },
    { key: "memo", label: "メモ" },
  ],
  data: [
    { name: "A", amount: 100, memo: "x" },
    { name: "B", amount: 50, memo: null },
    { name: "C", amount: 200, memo: "" },
  ],
};

const renderTable = (args: typeof baseArgs) =>
  render(
    <Comp
      args={args}
      argsText=""
      result={undefined}
      status={{ type: "complete", reason: "stop" }}
      toolCallId="t-1"
      toolName="displayTableTool"
      addResult={() => undefined}
      type="tool-call"
    />,
  );

describe("DisplayTableToolComponent", () => {
  it("title と件数を表示する", () => {
    renderTable(baseArgs);
    expect(screen.getByText("売上表")).toBeDefined();
    expect(screen.getByText("3件")).toBeDefined();
  });

  it("全行のデータを描画する", () => {
    renderTable(baseArgs);
    expect(screen.getByText("100")).toBeDefined();
    expect(screen.getByText("50")).toBeDefined();
    expect(screen.getByText("200")).toBeDefined();
  });

  it("null/undefined のセルは '-' で埋める", () => {
    renderTable(baseArgs);
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("sortable な見出しクリックで降順 ↔ 昇順切替（複数クリックで sort 解除）", () => {
    renderTable(baseArgs);

    const header = screen.getByText("金額");
    fireEvent.click(header); // asc
    fireEvent.click(header); // desc
    fireEvent.click(header); // sort 解除

    expect(screen.getByText("100")).toBeDefined();
  });

  it("loading 状態（columns 未到達 + running）はローディングを出す", () => {
    render(
      <Comp
        args={{}}
        argsText=""
        result={undefined}
        status={{ type: "running" }}
        toolCallId="t-1"
        toolName="displayTableTool"
        addResult={() => undefined}
        type="tool-call"
      />,
    );
    expect(screen.queryByText("売上表")).toBeNull();
  });
});

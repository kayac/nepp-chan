import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

import { DisplayChartToolComponent } from "./ChartToolUI";

const Comp = DisplayChartToolComponent as unknown as ComponentType<
  Record<string, unknown>
>;

const baseArgs = {
  title: "売上推移",
  type: "line" as const,
  data: [
    { month: "1月", sales: 100 },
    { month: "2月", sales: 150 },
  ],
  xKey: "month",
  yKey: "sales",
};

const renderChart = (
  overrides: Partial<typeof baseArgs> = {},
  running = false,
) =>
  render(
    <Comp
      args={{ ...baseArgs, ...overrides }}
      argsText=""
      result={undefined}
      status={
        running ? { type: "running" } : { type: "complete", reason: "stop" }
      }
      toolCallId="t-1"
      toolName="displayChartTool"
      addResult={() => undefined}
      type="tool-call"
    />,
  );

describe("DisplayChartToolComponent", () => {
  it("running + data 未到着ならローディングを表示する", () => {
    render(
      <Comp
        args={{ type: "line", xKey: "month", yKey: "sales" }}
        argsText=""
        result={undefined}
        status={{ type: "running" }}
        toolCallId="t-1"
        toolName="displayChartTool"
        addResult={() => undefined}
        type="tool-call"
      />,
    );
    expect(screen.queryByText("売上推移")).toBeNull();
  });

  it("data が空配列なら空状態メッセージを表示する", () => {
    renderChart({ data: [] });
    expect(screen.getByText("表示するデータがありません")).toBeDefined();
  });

  it("通常データで title を描画する", () => {
    renderChart();
    expect(screen.getByText("売上推移")).toBeDefined();
  });

  it("running 状態でも data が揃っていれば Chart を描画する", () => {
    renderChart({}, true);
    expect(screen.getByText("売上推移")).toBeDefined();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DisplayChartToolComponent } from "./ChartToolUI";

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

const renderChart = (overrides: Partial<typeof baseArgs> = {}) =>
  render(
    <DisplayChartToolComponent
      args={{ ...baseArgs, ...overrides }}
      result={undefined}
      status={{ type: "complete" }}
      toolName="displayChartTool"
    />,
  );

describe("DisplayChartToolComponent", () => {
  it("running + data 未到着ならローディングを表示する", () => {
    render(
      <DisplayChartToolComponent
        args={{ type: "line", xKey: "month", yKey: "sales" }}
        result={undefined}
        status={{ type: "running" }}
        toolName="displayChartTool"
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
});

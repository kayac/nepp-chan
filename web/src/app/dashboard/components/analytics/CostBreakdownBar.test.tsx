import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CostBreakdownBar } from "./CostBreakdownBar";

const segment = (key: string, costUsd: number) => ({
  key,
  label: key,
  color: "var(--brand)",
  costUsd,
});

describe("CostBreakdownBar", () => {
  it("コストの比率で各区分の幅を決める", () => {
    render(
      <CostBreakdownBar
        title="用途別"
        segments={[segment("会話", 0.75), segment("定期処理", 0.25)]}
      />,
    );

    const widths = [
      ...screen.getByTestId("cost-breakdown-segments").children,
    ].map((el) => (el as HTMLElement).style.width);

    expect(widths).toEqual(["75%", "25%"]);
  });

  it("合計が 0 なら何も描画しない", () => {
    const { container } = render(
      <CostBreakdownBar title="用途別" segments={[segment("会話", 0)]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

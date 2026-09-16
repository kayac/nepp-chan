import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chart, type ChartArgs } from "./Chart";

const data = [
  { name: "Mon", value: 10 },
  { name: "Tue", value: 20 },
];

describe("Chart", () => {
  it("title があれば見出しを描画", () => {
    const args: ChartArgs = {
      title: "週次推移",
      type: "line",
      data,
      xKey: "name",
      yKey: "value",
    };
    render(<Chart args={args} />);
    expect(screen.getByText("週次推移")).toBeInTheDocument();
  });

  it("title が空なら見出しを描画しない", () => {
    const args: ChartArgs = {
      title: "",
      type: "bar",
      data,
      xKey: "name",
      yKey: "value",
    };
    const { container } = render(<Chart args={args} />);
    expect(container.querySelector("h3")).toBeNull();
  });
});

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

  it("title なしなら見出しを描画しない", () => {
    const args: ChartArgs = {
      type: "bar",
      data,
      xKey: "name",
      yKey: "value",
    };
    const { container } = render(<Chart args={args} />);
    expect(container.querySelector("h3")).toBeNull();
  });

  it("pie タイプでも render エラーにならない", () => {
    const args: ChartArgs = {
      type: "pie",
      data,
      xKey: "name",
      yKey: "value",
    };
    const { container } = render(<Chart args={args} />);
    expect(container).toBeTruthy();
  });

  it("title + bar タイプでバーアイコンを描画", () => {
    const args: ChartArgs = {
      title: "棒",
      type: "bar",
      data,
      xKey: "name",
      yKey: "value",
    };
    const { container } = render(<Chart args={args} />);
    // lucide-react は svg を返す。アイコン自体の存在をヘッダーから確認する
    expect(container.querySelector("h3")?.textContent).toBe("棒");
    expect(container.querySelector("h3")?.previousElementSibling?.tagName).toBe(
      "svg",
    );
  });

  it("title + pie タイプでパイアイコンを描画", () => {
    const args: ChartArgs = {
      title: "円",
      type: "pie",
      data,
      xKey: "name",
      yKey: "value",
    };
    const { container } = render(<Chart args={args} />);
    expect(container.querySelector("h3")?.textContent).toBe("円");
    expect(container.querySelector("h3")?.previousElementSibling?.tagName).toBe(
      "svg",
    );
  });
});

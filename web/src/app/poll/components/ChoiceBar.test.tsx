import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChoiceBar } from "./ChoiceBar";

describe("ChoiceBar", () => {
  it("choice / count / percentage を描画", () => {
    render(
      <ChoiceBar choice="赤" count={7} percentage={58} isLeading={false} />,
    );
    expect(screen.getByText("赤")).toBeInTheDocument();
    expect(screen.getByText("7票")).toBeInTheDocument();
    expect(screen.getByText("58%")).toBeInTheDocument();
  });

  it("isLeading=true なら bar に brand teal-500 クラスが付く", () => {
    const { container } = render(
      <ChoiceBar choice="A" count={5} percentage={50} isLeading />,
    );
    const bar = container.querySelector(".bg-\\(--teal-500\\)");
    expect(bar).not.toBeNull();
  });

  it("isLeading=false なら bar は brand teal-300", () => {
    const { container } = render(
      <ChoiceBar choice="A" count={1} percentage={10} isLeading={false} />,
    );
    expect(container.querySelector(".bg-\\(--teal-300\\)")).not.toBeNull();
  });
});

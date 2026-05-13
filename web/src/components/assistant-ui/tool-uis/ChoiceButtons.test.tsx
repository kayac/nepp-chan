import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChoiceButtons, SelectedResult } from "./ChoiceButtons";

const args = {
  question: "好きな色は？",
  choices: ["赤", "青", "緑"],
};

describe("ChoiceButtons", () => {
  it("質問と全選択肢を描画", () => {
    render(<ChoiceButtons args={args} onSelect={vi.fn()} />);
    expect(screen.getByText("好きな色は？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "赤" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "青" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "緑" })).toBeInTheDocument();
  });

  it("クリックで onSelect(choice, index)", () => {
    const onSelect = vi.fn();
    render(<ChoiceButtons args={args} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "青" }));
    expect(onSelect).toHaveBeenCalledWith("青", 1);
  });

  it("選択後はすべての button が disabled", () => {
    render(<ChoiceButtons args={args} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "赤" }));

    const buttons = screen.getAllByRole("button") as HTMLButtonElement[];
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });
});

describe("SelectedResult", () => {
  it("選ばれた選択肢にハイライト、他はグレー", () => {
    const { container } = render(
      <SelectedResult
        args={args}
        result={{ selectedChoice: "赤", selectedIndex: 0 }}
      />,
    );
    expect(container.querySelectorAll(".bg-amber-500")).toHaveLength(1);
    expect(container.querySelectorAll(".bg-gray-100")).toHaveLength(2);
  });

  it("question を表示", () => {
    render(
      <SelectedResult
        args={args}
        result={{ selectedChoice: "青", selectedIndex: 1 }}
      />,
    );
    expect(screen.getByText("好きな色は？")).toBeInTheDocument();
  });
});

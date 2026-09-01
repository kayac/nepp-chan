import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterTabs } from "./FilterTabs";

const options = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
] as const;

describe("FilterTabs", () => {
  it("選択中の値をハイライトする", () => {
    render(<FilterTabs options={options} value="a" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "A" })).toHaveClass(
      "bg-stone-800",
    );
    expect(screen.getByRole("button", { name: "B" })).not.toHaveClass(
      "bg-stone-800",
    );
  });

  it("クリックで onChange に値を渡す", async () => {
    const onChange = vi.fn();
    render(<FilterTabs options={options} value="a" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

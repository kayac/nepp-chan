import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchBox } from "./SearchBox";

describe("SearchBox", () => {
  it("入力値を onChange に渡す", async () => {
    const onChange = vi.fn();
    render(
      <SearchBox
        label="訂正を検索"
        placeholder="パスや本文で絞り込む"
        value=""
        onChange={onChange}
      />,
    );

    await userEvent.type(
      screen.getByRole("searchbox", { name: "訂正を検索" }),
      "バ",
    );

    expect(onChange).toHaveBeenCalledWith("バ");
  });

  it("value を表示し placeholder を出す", () => {
    render(
      <SearchBox
        label="訂正を検索"
        placeholder="パスや本文で絞り込む"
        value="バス"
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByRole("searchbox", { name: "訂正を検索" });
    expect(input).toHaveValue("バス");
    expect(input).toHaveAttribute("placeholder", "パスや本文で絞り込む");
  });
});

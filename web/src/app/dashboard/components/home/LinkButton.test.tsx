import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LinkButton } from "./LinkButton";

describe("LinkButton", () => {
  it("ラベルに矢印を添えて出す", () => {
    render(<LinkButton label="詳しく見る" onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "詳しく見る →" })).toBeVisible();
  });

  it("押すと onClick を呼ぶ", async () => {
    const onClick = vi.fn();
    render(<LinkButton label="詳しく見る" onClick={onClick} />);

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopBar } from "./TopBar";

describe("TopBar", () => {
  it("ロゴと BETA バッジを表示する", () => {
    render(<TopBar onMenuClick={vi.fn()} />);
    expect(screen.getByAltText("ねっぷちゃん")).toBeDefined();
    expect(screen.getByText("BETA")).toBeDefined();
  });

  it("メニューボタンクリックで onMenuClick が呼ばれる", () => {
    const onMenuClick = vi.fn();
    render(<TopBar onMenuClick={onMenuClick} />);

    fireEvent.click(screen.getByRole("button", { name: "メニュー" }));
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it("LP へのリンクを持つ", () => {
    render(<TopBar onMenuClick={vi.fn()} />);
    const link = screen.getByLabelText("ねっぷちゃん 紹介ページへ");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBeTruthy();
  });
});

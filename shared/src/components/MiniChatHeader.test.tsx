import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiniChatHeader } from "./MiniChatHeader";

describe("MiniChatHeader", () => {
  it("名前とオンライン状態を表示する", () => {
    render(<MiniChatHeader />);
    expect(screen.getByText("ねっぷちゃん")).toBeTruthy();
    expect(screen.getByText("オンライン")).toBeTruthy();
  });

  it("iconSrc を img の src に反映する", () => {
    const { container } = render(<MiniChatHeader iconSrc="/custom/icon.png" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/custom/icon.png",
    );
  });

  it("iconSrc 省略時はデフォルトのマスコット画像を使う", () => {
    const { container } = render(<MiniChatHeader />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/mascot/icon.png",
    );
  });

  it("action で渡した要素を右側に描画する", () => {
    render(<MiniChatHeader action={<button type="button">閉じる</button>} />);
    expect(screen.getByRole("button", { name: "閉じる" })).toBeTruthy();
  });

  it("className を外側要素にマージする", () => {
    const { container } = render(<MiniChatHeader className="px-4 py-3" />);
    expect(container.firstElementChild?.className).toContain("px-4");
    expect(container.firstElementChild?.className).toContain("py-3");
  });
});

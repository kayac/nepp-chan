import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiniChatHeader } from "./MiniChatHeader";

describe("MiniChatHeader", () => {
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
});

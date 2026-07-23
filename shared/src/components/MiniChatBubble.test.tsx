import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiniChatBubble } from "./MiniChatBubble";

describe("MiniChatBubble", () => {
  it("children をそのまま描画する", () => {
    render(<MiniChatBubble variant="assistant">こんにちは</MiniChatBubble>);
    expect(screen.getByText("こんにちは")).toBeTruthy();
  });

  it("assistant variant は self-start とブランド以外の背景色を持つ", () => {
    const { container } = render(
      <MiniChatBubble variant="assistant">assistant</MiniChatBubble>,
    );
    const className = container.firstElementChild?.className ?? "";
    expect(className).toContain("self-start");
    expect(className).toContain("bg-(--paper-50)");
  });

  it("user variant は self-end とブランド背景色を持つ", () => {
    const { container } = render(
      <MiniChatBubble variant="user">user</MiniChatBubble>,
    );
    const className = container.firstElementChild?.className ?? "";
    expect(className).toContain("self-end");
    expect(className).toContain("bg-(--brand-hover)");
  });

  it("className を追加クラスとしてマージする", () => {
    const { container } = render(
      <MiniChatBubble
        variant="assistant"
        className="shadow-(--shadow-float-sm)"
      >
        text
      </MiniChatBubble>,
    );
    expect(container.firstElementChild?.className).toContain(
      "shadow-(--shadow-float-sm)",
    );
  });

  it("className で max-w を上書きできる", () => {
    const { container } = render(
      <MiniChatBubble variant="assistant" className="max-w-[78%]">
        text
      </MiniChatBubble>,
    );
    const className = container.firstElementChild?.className ?? "";
    expect(className).toContain("max-w-[78%]");
    expect(className).not.toContain("max-w-[85%]");
  });
});

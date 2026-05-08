import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SpeechBubble } from "./SpeechBubble";

describe("SpeechBubble", () => {
  it("children をそのまま描画する", () => {
    render(<SpeechBubble>こんにちは</SpeechBubble>);
    expect(screen.getByText("こんにちは")).toBeDefined();
  });

  it("variant=user で user 用のクラスが付く", () => {
    const { container } = render(
      <SpeechBubble variant="user">hi</SpeechBubble>,
    );
    const bubble = container.firstElementChild;
    expect(bubble?.className).toContain("teal-700");
  });

  it("variant 省略時は assistant スタイル", () => {
    const { container } = render(<SpeechBubble>x</SpeechBubble>);
    const bubble = container.firstElementChild;
    expect(bubble?.className).toContain("paper-0");
  });

  it("className と style がマージされる", () => {
    const { container } = render(
      <SpeechBubble className="extra-cls" style={{ marginTop: "10px" }}>
        x
      </SpeechBubble>,
    );
    const bubble = container.firstElementChild as HTMLElement;
    expect(bubble.className).toContain("extra-cls");
    expect(bubble.style.marginTop).toBe("10px");
  });
});

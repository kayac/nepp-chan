import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScrollToBottomButton } from "./ScrollToBottomButton";

describe("ScrollToBottomButton", () => {
  it("最下部にいるときは押せない", () => {
    render(<ScrollToBottomButton isAtBottom onClick={() => {}} />);
    expect(
      screen.getByLabelText("下にスクロール").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("最下部から離れているとクリックで onClick を呼ぶ", () => {
    const onClick = vi.fn();
    render(<ScrollToBottomButton isAtBottom={false} onClick={onClick} />);

    fireEvent.click(screen.getByLabelText("下にスクロール"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

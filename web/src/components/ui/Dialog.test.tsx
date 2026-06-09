import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("マウント時に子要素を表示する", () => {
    render(
      <Dialog onClose={vi.fn()}>
        <p>本文</p>
      </Dialog>,
    );
    expect(screen.getByText("本文")).toBeInTheDocument();
  });

  it("backdrop（dialog 自身）クリックで onClose を呼ぶ", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog onClose={onClose}>
        <div>パネル</div>
      </Dialog>,
    );
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("dialog not found");
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("子要素クリックでは onClose を呼ばない", () => {
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose}>
        <button type="button">中身</button>
      </Dialog>,
    );
    fireEvent.click(screen.getByText("中身"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("dialog の close（ESC 相当）で onClose を呼ぶ", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog onClose={onClose}>
        <div>パネル</div>
      </Dialog>,
    );
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("dialog not found");
    dialog.close();
    expect(onClose).toHaveBeenCalled();
  });

  it("className を dialog にマージする", () => {
    const { container } = render(
      <Dialog onClose={vi.fn()} className="max-w-lg backdrop:bg-stone-900/30">
        <div>パネル</div>
      </Dialog>,
    );
    const dialog = container.querySelector("dialog");
    expect(dialog?.className).toContain("max-w-lg");
    expect(dialog?.className).toContain("backdrop:bg-stone-900/30");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThreadDeleteModal } from "./ThreadDeleteModal";

describe("ThreadDeleteModal", () => {
  it("見出しと注意文を描画", () => {
    render(
      <ThreadDeleteModal
        isDeleting={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("スレッドを削除")).toBeInTheDocument();
    expect(screen.getByText(/このスレッドを削除しますか/)).toBeInTheDocument();
  });

  it("削除ボタンで onConfirm", () => {
    const onConfirm = vi.fn();
    render(
      <ThreadDeleteModal
        isDeleting={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("削除"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("キャンセルボタンで onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ThreadDeleteModal
        isDeleting={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    // overlay と本文ボタンが両方 aria-label/text="キャンセル" を持つので index 指定
    const cancelButtons = screen.getAllByRole("button", { name: "キャンセル" });
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);
    expect(onCancel).toHaveBeenCalled();
  });

  it("isDeleting=true なら削除ボタンに『削除中...』表示", () => {
    render(
      <ThreadDeleteModal isDeleting onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("削除中...")).toBeInTheDocument();
  });
});

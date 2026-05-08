import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeedbackModal } from "./FeedbackModal";

describe("FeedbackModal", () => {
  it("isOpen=false なら何も描画しない", () => {
    const { container } = render(
      <FeedbackModal
        isOpen={false}
        onClose={vi.fn()}
        rating="good"
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("rating=good ではカテゴリ選択肢を出さない", () => {
    render(
      <FeedbackModal
        isOpen
        onClose={vi.fn()}
        rating="good"
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(screen.getByText("フィードバック")).toBeDefined();
    expect(screen.queryByText("どこが問題でしたか？")).toBeNull();
  });

  it("rating=bad ではカテゴリが必須（未選択は送信無効）", () => {
    render(
      <FeedbackModal
        isOpen
        onClose={vi.fn()}
        rating="bad"
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    const submit = screen.getByRole("button", { name: "送信" });
    expect(submit.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByText("情報が古い"));
    expect(submit.hasAttribute("disabled")).toBe(false);
  });

  it("送信時に category と trim 済 comment が onSubmit に渡る", () => {
    const onSubmit = vi.fn();
    render(
      <FeedbackModal
        isOpen
        onClose={vi.fn()}
        rating="bad"
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );

    fireEvent.click(screen.getByText("質問に答えていない"));
    fireEvent.change(screen.getByLabelText("コメント（任意）"), {
      target: { value: "  comment  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    expect(onSubmit).toHaveBeenCalledWith({
      category: "off_topic",
      comment: "comment",
    });
  });

  it("good では category=undefined、空コメントは undefined", () => {
    const onSubmit = vi.fn();
    render(
      <FeedbackModal
        isOpen
        onClose={vi.fn()}
        rating="good"
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    expect(onSubmit).toHaveBeenCalledWith({
      category: undefined,
      comment: undefined,
    });
  });

  it("close 時に内部 state がリセットされる", () => {
    const onClose = vi.fn();
    render(
      <FeedbackModal
        isOpen
        onClose={onClose}
        rating="bad"
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );

    fireEvent.click(screen.getAllByLabelText("閉じる")[0]);
    expect(onClose).toHaveBeenCalled();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackModal } from "./FeedbackModal";

const submit = vi.fn();
let isSubmitting = false;

vi.mock("~/app/chat/hooks/useSubmitFeedback", () => ({
  useSubmitFeedback: () => ({ submit, isSubmitting }),
}));

beforeEach(() => {
  submit.mockReset();
  submit.mockResolvedValue(undefined);
  isSubmitting = false;
});

describe("FeedbackModal", () => {
  it("マウント時にモーダルを開く", () => {
    render(<FeedbackModal messageId="m-1" rating="good" onClose={vi.fn()} />);
    expect(screen.getByText("フィードバック")).toBeInTheDocument();
  });

  it("rating=good ではカテゴリ選択肢を出さない", () => {
    render(<FeedbackModal messageId="m-1" rating="good" onClose={vi.fn()} />);
    expect(screen.getByText("フィードバック")).toBeInTheDocument();
    expect(screen.queryByText("どこが問題でしたか？")).toBeNull();
  });

  it("rating=bad ではカテゴリが必須（未選択は送信無効）", () => {
    render(<FeedbackModal messageId="m-1" rating="bad" onClose={vi.fn()} />);
    const submitButton = screen.getByRole("button", { name: "送信" });
    expect(submitButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByText("情報が古い"));
    expect(submitButton.hasAttribute("disabled")).toBe(false);
  });

  it("送信時に messageId / rating / category / trim 済 comment を渡す", async () => {
    const onClose = vi.fn();
    render(<FeedbackModal messageId="m-1" rating="bad" onClose={onClose} />);

    fireEvent.click(screen.getByText("質問に答えていない"));
    fireEvent.change(screen.getByLabelText("コメント（任意）"), {
      target: { value: "  comment  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    expect(submit).toHaveBeenCalledWith("m-1", "bad", {
      category: "off_topic",
      comment: "comment",
    });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("good では category=undefined、空コメントは undefined", () => {
    render(<FeedbackModal messageId="m-1" rating="good" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    expect(submit).toHaveBeenCalledWith("m-1", "good", {
      category: undefined,
      comment: undefined,
    });
  });

  it("送信に失敗してもモーダルは閉じない", async () => {
    submit.mockRejectedValueOnce(new Error("失敗"));
    const onClose = vi.fn();
    render(<FeedbackModal messageId="m-1" rating="good" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    await vi.waitFor(() => expect(submit).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("閉じるボタンで onClose を呼ぶ", () => {
    const onClose = vi.fn();
    render(<FeedbackModal messageId="m-1" rating="bad" onClose={onClose} />);

    fireEvent.click(screen.getAllByLabelText("閉じる")[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("dialog の close（ESC 相当）で onClose を呼ぶ", () => {
    const onClose = vi.fn();
    const { container } = render(
      <FeedbackModal messageId="m-1" rating="good" onClose={onClose} />,
    );

    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("dialog not found");
    dialog.close();
    expect(onClose).toHaveBeenCalled();
  });
});

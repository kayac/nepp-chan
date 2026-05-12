import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MessageFeedback } from "~/types";
import { FeedbackDetailModal } from "./FeedbackDetailModal";

const baseFeedback: MessageFeedback = {
  id: "f-1",
  threadId: "t-1",
  messageId: "m-1",
  rating: "good",
  category: null,
  comment: null,
  conversationContext: {
    previousMessages: [],
    targetMessage: { id: "m-1", role: "assistant", content: "対象メッセージ" },
    nextMessages: [],
  },
  toolExecutions: null,
  createdAt: "2030-01-01T12:00:00.000Z",
  resolvedAt: null,
};

describe("FeedbackDetailModal", () => {
  it("基本ヘッダーと対象メッセージを描画", () => {
    render(<FeedbackDetailModal feedback={baseFeedback} onClose={vi.fn()} />);
    expect(screen.getByText("フィードバック詳細")).toBeInTheDocument();
    expect(screen.getByText("対象メッセージ")).toBeInTheDocument();
    expect(screen.getByText("良い回答")).toBeInTheDocument();
  });

  it("rating=bad のときは『改善が必要』を表示", () => {
    render(
      <FeedbackDetailModal
        feedback={{ ...baseFeedback, rating: "bad" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("改善が必要")).toBeInTheDocument();
  });

  it("rating=idea のときは『アイデア』を表示", () => {
    render(
      <FeedbackDetailModal
        feedback={{ ...baseFeedback, rating: "idea" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("アイデア")).toBeInTheDocument();
  });

  it("comment があれば描画、無ければ表示しない", () => {
    const { rerender } = render(
      <FeedbackDetailModal
        feedback={{ ...baseFeedback, comment: "テストコメント" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("テストコメント")).toBeInTheDocument();
    expect(screen.getByText("コメント")).toBeInTheDocument();

    rerender(<FeedbackDetailModal feedback={baseFeedback} onClose={vi.fn()} />);
    expect(screen.queryByText("コメント")).not.toBeInTheDocument();
  });

  it("閉じるボタンで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<FeedbackDetailModal feedback={baseFeedback} onClose={onClose} />);

    fireEvent.click(screen.getAllByLabelText("閉じる")[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("toolExecutions があるとツール実行結果セクションを表示", () => {
    render(
      <FeedbackDetailModal
        feedback={{
          ...baseFeedback,
          toolExecutions: [
            {
              toolName: "test-tool",
              state: "result",
              input: { q: "hello" },
              output: "ok",
              errorText: undefined,
            },
          ],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("ツール実行結果")).toBeInTheDocument();
    expect(screen.getByText("test-tool")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FEEDBACK_CATEGORY_LABELS, type MessageFeedback } from "~/types";
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

  it("category が既知ならラベルへ変換して表示", () => {
    render(
      <FeedbackDetailModal
        feedback={{ ...baseFeedback, category: "incorrect_fact" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("事実と異なる")).toBeInTheDocument();
  });

  it("category が未知ラベルなら raw 値をそのまま表示", () => {
    render(
      <FeedbackDetailModal
        feedback={{
          ...baseFeedback,
          // biome-ignore lint/suspicious/noExplicitAny: ラベル未定義 category のフォールバック検証
          category: "unknown_category" as any,
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("unknown_category")).toBeInTheDocument();
  });

  it("category が null ならカテゴリバッジを表示しない", () => {
    render(<FeedbackDetailModal feedback={baseFeedback} onClose={vi.fn()} />);
    for (const label of Object.values(FEEDBACK_CATEGORY_LABELS)) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("previousMessages の role で送信者ラベルを出し分ける", () => {
    render(
      <FeedbackDetailModal
        feedback={{
          ...baseFeedback,
          conversationContext: {
            ...baseFeedback.conversationContext,
            previousMessages: [
              { id: "p-user", role: "user", content: "前のユーザー発話" },
              { id: "p-asst", role: "assistant", content: "前のAI発話" },
            ],
          },
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("前のユーザー発話")).toBeInTheDocument();
    expect(screen.getByText("前のAI発話")).toBeInTheDocument();
    expect(screen.getByText("ユーザー")).toBeInTheDocument();
  });

  it("targetMessage が user role なら『ユーザー（対象メッセージ）』を表示", () => {
    render(
      <FeedbackDetailModal
        feedback={{
          ...baseFeedback,
          conversationContext: {
            ...baseFeedback.conversationContext,
            targetMessage: {
              id: "m-1",
              role: "user",
              content: "ユーザーの質問",
            },
          },
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("ユーザー（対象メッセージ）")).toBeInTheDocument();
    expect(screen.getByText("ユーザーの質問")).toBeInTheDocument();
  });

  it("targetMessage が assistant role なら『ねっぷちゃん（対象メッセージ）』を表示", () => {
    render(<FeedbackDetailModal feedback={baseFeedback} onClose={vi.fn()} />);
    expect(
      screen.getByText("ねっぷちゃん（対象メッセージ）"),
    ).toBeInTheDocument();
  });

  it("nextMessages の role で送信者ラベルを出し分ける", () => {
    render(
      <FeedbackDetailModal
        feedback={{
          ...baseFeedback,
          conversationContext: {
            ...baseFeedback.conversationContext,
            nextMessages: [
              { id: "n-user", role: "user", content: "次のユーザー発話" },
              { id: "n-asst", role: "assistant", content: "次のAI発話" },
            ],
          },
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("次のユーザー発話")).toBeInTheDocument();
    expect(screen.getByText("次のAI発話")).toBeInTheDocument();
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

  it("output がオブジェクトなら JSON.stringify で表示", () => {
    render(
      <FeedbackDetailModal
        feedback={{
          ...baseFeedback,
          toolExecutions: [
            {
              toolName: "obj-tool",
              state: "result",
              input: undefined,
              output: { ok: true, value: 1 },
              errorText: undefined,
            },
          ],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/"ok": true/)).toBeInTheDocument();
  });

  it("state=call は『call』バッジを描画", () => {
    render(
      <FeedbackDetailModal
        feedback={{
          ...baseFeedback,
          toolExecutions: [
            {
              toolName: "calling",
              state: "call",
              input: undefined,
              output: undefined,
              errorText: undefined,
            },
          ],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("call")).toBeInTheDocument();
  });

  it("state=error + errorText でエラーセクションを描画", () => {
    render(
      <FeedbackDetailModal
        feedback={{
          ...baseFeedback,
          toolExecutions: [
            {
              toolName: "err-tool",
              state: "error",
              input: undefined,
              output: undefined,
              errorText: "API failed",
            },
          ],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("エラー:")).toBeInTheDocument();
    expect(screen.getByText("API failed")).toBeInTheDocument();
  });
});

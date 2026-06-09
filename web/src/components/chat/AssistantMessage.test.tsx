import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";

import { ChatContext, type ChatContextValue } from "~/app/chat/useChatContext";

import { AssistantMessage, PendingAssistantMessage } from "./AssistantMessage";

const submit = vi.fn();
vi.mock("~/app/chat/hooks/useSubmitFeedback", () => ({
  useSubmitFeedback: () => ({ submit, isSubmitting: false }),
}));

const textMessage = (text: string): UIMessage => ({
  id: "a-1",
  role: "assistant",
  parts: [{ type: "text", text }],
});

const renderMessage = (
  message: UIMessage,
  isLast: boolean,
  ctx: Partial<ChatContextValue> = {},
) => {
  const value: ChatContextValue = {
    threadId: "t-1",
    messages: [message],
    status: "ready",
    error: undefined,
    isRunning: false,
    sendMessage: vi.fn(),
    stop: vi.fn(),
    ...ctx,
  };
  return render(
    <ChatContext.Provider value={value}>
      <AssistantMessage message={message} isLast={isLast} />
    </ChatContext.Provider>,
  );
};

describe("AssistantMessage", () => {
  it("テキストパートを Markdown で表示する", () => {
    renderMessage(textMessage("こんにちは"), true);
    expect(screen.getByText("こんにちは")).toBeInTheDocument();
  });

  it("生成完了後はフィードバックバーを表示する", () => {
    renderMessage(textMessage("回答"), true);
    expect(
      screen.getByText("この回答は役に立ちましたか？"),
    ).toBeInTheDocument();
  });

  it("フィードバックボタンでモーダルを開く", async () => {
    renderMessage(textMessage("回答"), true);
    await userEvent.click(screen.getByLabelText("良い回答"));
    expect(screen.getByText("フィードバック")).toBeInTheDocument();
  });

  it("最新メッセージの生成中はフィードバックバーを隠す", () => {
    renderMessage(textMessage("生成中"), true, { isRunning: true });
    expect(
      screen.queryByText("この回答は役に立ちましたか？"),
    ).not.toBeInTheDocument();
  });

  it("最新メッセージにエラーがあるとエラーを表示する", () => {
    renderMessage(textMessage("回答"), true, {
      error: new Error("通信に失敗しました"),
    });
    expect(screen.getByText("通信に失敗しました")).toBeInTheDocument();
  });

  it("ツールパートを ToolPart 経由で表示する", () => {
    const message: UIMessage = {
      id: "a-1",
      role: "assistant",
      parts: [
        {
          type: "tool-knowledge-search",
          toolCallId: "t-1",
          state: "output-available",
          input: {},
          output: {},
        } as never,
      ],
    };
    renderMessage(message, true);
    expect(screen.getByText("ねっぷちゃんが調査しました")).toBeInTheDocument();
  });

  it("bad のフィードバックで改善点モーダルを開く", async () => {
    renderMessage(textMessage("回答"), true);

    await userEvent.click(screen.getByLabelText("改善が必要"));
    expect(screen.getByText("改善点を教えてください")).toBeInTheDocument();
  });

  it("idea のフィードバックで改善要望モーダルを開く", async () => {
    renderMessage(textMessage("回答"), true);

    await userEvent.click(screen.getByLabelText("アイディア"));
    expect(screen.getByText("改善要望")).toBeInTheDocument();
  });

  it("生成中で内容が空のときタイピングドットを表示する", () => {
    const empty: UIMessage = { id: "a-1", role: "assistant", parts: [] };
    const { container } = renderMessage(empty, true, { isRunning: true });
    expect(container.querySelector(".aui-typing-dot")).not.toBeNull();
  });

  it("テキストがあればタイピングドットを出さない", () => {
    const { container } = renderMessage(textMessage("やあ"), true, {
      isRunning: true,
    });
    expect(container.querySelector(".aui-typing-dot")).toBeNull();
  });
});

describe("PendingAssistantMessage", () => {
  it("タイピングドットを表示する", () => {
    const { container } = render(<PendingAssistantMessage />);
    expect(container.querySelector(".aui-typing-dot")).not.toBeNull();
  });
});

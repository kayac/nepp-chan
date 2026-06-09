import { act, renderHook } from "@testing-library/react";
import type { UIMessage } from "ai";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatContext, type ChatContextValue } from "~/app/chat/useChatContext";
import { feedbackRepository } from "~/lib/api/repository";

import { useSubmitFeedback } from "./useSubmitFeedback";

const submitFeedback = vi.spyOn(feedbackRepository, "submitFeedback");

beforeEach(() => {
  submitFeedback.mockReset();
  submitFeedback.mockResolvedValue(undefined as never);
});

const userMessage: UIMessage = {
  id: "u-1",
  role: "user",
  parts: [{ type: "text", text: "音威子府村の人口は？" }],
};

const assistantMessage: UIMessage = {
  id: "a-1",
  role: "assistant",
  parts: [
    { type: "text", text: "約700人です" },
    {
      type: "tool-knowledgeSearch",
      toolCallId: "t-1",
      state: "output-available",
      input: { query: "人口" },
      output: { hits: 1 },
    } as never,
  ],
};

const renderSubmit = (messages: UIMessage[]) => {
  const value: ChatContextValue = {
    threadId: "thread-1",
    messages,
    status: "ready",
    error: undefined,
    isRunning: false,
    sendMessage: vi.fn(),
    stop: vi.fn(),
  };
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(ChatContext.Provider, { value }, children);
  return renderHook(() => useSubmitFeedback(), { wrapper });
};

describe("useSubmitFeedback", () => {
  it("threadId / 会話文脈 / ツール実行を組み立てて submitFeedback を呼ぶ", async () => {
    const { result } = renderSubmit([userMessage, assistantMessage]);

    await act(async () => {
      await result.current.submit("a-1", "good", { comment: "助かりました" });
    });

    expect(submitFeedback).toHaveBeenCalledWith({
      threadId: "thread-1",
      messageId: "a-1",
      rating: "good",
      category: undefined,
      comment: "助かりました",
      conversationContext: {
        targetMessage: { id: "a-1", role: "assistant", content: "約700人です" },
        previousMessages: [
          { id: "u-1", role: "user", content: "音威子府村の人口は？" },
        ],
        nextMessages: [],
      },
      toolExecutions: [
        {
          toolName: "knowledgeSearch",
          state: "output-available",
          input: { query: "人口" },
          output: { hits: 1 },
          errorText: undefined,
        },
      ],
    });
  });

  it("ツール実行が無い場合は toolExecutions を渡さない", async () => {
    const textOnly: UIMessage = {
      id: "a-2",
      role: "assistant",
      parts: [{ type: "text", text: "こんにちは" }],
    };
    const { result } = renderSubmit([textOnly]);

    await act(async () => {
      await result.current.submit("a-2", "idea", {});
    });

    expect(submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ toolExecutions: undefined }),
    );
  });

  it("対象メッセージが無ければ submitFeedback を呼ばない", async () => {
    const { result } = renderSubmit([assistantMessage]);

    await act(async () => {
      await result.current.submit("missing", "good", {});
    });

    expect(submitFeedback).not.toHaveBeenCalled();
  });
});

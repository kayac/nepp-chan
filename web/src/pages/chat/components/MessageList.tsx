import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";

import type { FeedbackRating } from "~/types";

import { MessageItem } from "./MessageItem";

type Props = {
  messages: UIMessage[];
  isLoading: boolean;
  onFeedbackClick?: (messageId: string, rating: FeedbackRating) => void;
  submittedFeedbacks?: Record<string, FeedbackRating>;
};

const isLastMessageFromAssistant = (messages: UIMessage[]): boolean => {
  if (messages.length === 0) return false;
  return messages[messages.length - 1].role === "assistant";
};

export const MessageList = ({
  messages,
  isLoading,
  onFeedbackClick,
  submittedFeedbacks,
}: Props) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessage?.parts, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--color-text-muted)] text-sm">
            ねっぷちゃんに話しかけてみよう！
          </p>
        </div>
      </div>
    );
  }

  const showPendingBubble = isLoading && !isLastMessageFromAssistant(messages);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            isStreaming={isLoading && index === messages.length - 1}
            onFeedbackClick={
              message.role === "assistant" && onFeedbackClick
                ? (rating) => onFeedbackClick(message.id, rating)
                : undefined
            }
            submittedRating={submittedFeedbacks?.[message.id]}
          />
        ))}
        {showPendingBubble && (
          <div className="animate-fade-in">
            <div className="text-xs text-[var(--color-text-muted)] mb-1.5 flex items-center gap-1">
              <span>ねっぷちゃん</span>
            </div>
            <div className="inline-block bg-[var(--color-surface)] rounded-2xl rounded-tl-sm px-4 py-2.5">
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <span>🤔</span>
                <span className="animate-pulse">考え中...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

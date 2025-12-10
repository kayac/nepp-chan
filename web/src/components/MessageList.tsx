import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { MessageItem } from "./MessageItem";

type Props = {
  messages: UIMessage[];
  isLoading: boolean;
};

// 最後のメッセージがアシスタントかどうか判定
const isLastMessageFromAssistant = (messages: UIMessage[]): boolean => {
  if (messages.length === 0) return false;
  return messages[messages.length - 1].role === "assistant";
};

export const MessageList = ({ messages, isLoading }: Props) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessage?.parts, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">🦊</div>
          <p>ねっぷちゃんに話しかけてみよう！</p>
        </div>
      </div>
    );
  }

  // ローディング中かつまだアシスタントのメッセージが追加されていない場合
  const showPendingBubble = isLoading && !isLastMessageFromAssistant(messages);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          isStreaming={isLoading && index === messages.length - 1}
        />
      ))}
      {showPendingBubble && (
        <div className="flex justify-start mb-4">
          <div className="max-w-[80%]">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2">
              <div className="text-xs text-gray-500 mb-1 font-medium">
                ねっぷちゃん
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <span className="text-lg">🤔</span>
                <span className="animate-pulse">考え中...</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

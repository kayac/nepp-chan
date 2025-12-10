import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { MessageItem } from "./MessageItem";

type Props = {
  messages: UIMessage[];
  isLoading: boolean;
};

const getMessageContent = (message: UIMessage): string => {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
};

export const MessageList = ({ messages, isLoading }: Props) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessage?.parts]);

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

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      {isLoading && getMessageContent(messages[messages.length - 1]) === "" && (
        <div className="flex justify-start mb-4">
          <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

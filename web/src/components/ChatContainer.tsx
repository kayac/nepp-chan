import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

const generateThreadId = () => crypto.randomUUID();

export const ChatContainer = () => {
  const threadId = useMemo(() => generateThreadId(), []);
  const resourceId = "default-user";

  const { messages, status, error, sendMessage, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/chat",
      prepareSendMessagesRequest({ messages }) {
        return {
          body: {
            messages: messages.map((m) => ({
              role: m.role,
              content:
                m.parts
                  ?.filter(
                    (p): p is { type: "text"; text: string } =>
                      p.type === "text",
                  )
                  .map((p) => p.text)
                  .join("") ?? "",
            })),
            resourceId,
            threadId,
          },
        };
      },
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  const clearMessages = () => {
    setMessages([]);
  };

  const handleSend = (content: string) => {
    sendMessage({ text: content });
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦊</span>
          <h1 className="text-lg font-bold text-gray-800">ねっぷちゃん</h1>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearMessages}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            会話をクリア
          </button>
        )}
      </header>

      <MessageList messages={messages} isLoading={isLoading} />

      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          エラー: {error.message}
        </div>
      )}

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
};

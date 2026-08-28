import { useChat } from "@ai-sdk/react";
import { messageText } from "@nepp-chan/shared/lib/message-text";
import type { UIMessage } from "ai";
import { type ReactNode, useEffect, useMemo, useRef } from "react";

import { createThreadChatTransport } from "~/lib/api/chat-transport";

import { buildGreetingPrompt, isGreetingPrompt } from "../greeting-prompt";
import { ChatContext, type ChatContextValue } from "./ChatContext";

export type InitialMessage =
  | { type: "greeting"; location: string | null }
  | { type: "user"; text: string };

interface Props {
  threadId: string;
  initialMessages?: UIMessage[];
  initialMessage?: InitialMessage;
  children: ReactNode;
}

export const ChatProvider = ({
  threadId,
  initialMessages,
  initialMessage,
  children,
}: Props) => {
  const transport = useMemo(
    () =>
      createThreadChatTransport(threadId, {
        resolveIntent: (lastMessage) => {
          const lastText = lastMessage ? messageText(lastMessage) : "";
          return isGreetingPrompt(lastText) ? "casual" : undefined;
        },
      }),
    [threadId],
  );

  const { messages, status, error, sendMessage, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    experimental_throttle: 50,
  });

  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !initialMessage) return;
    sent.current = true;
    const text =
      initialMessage.type === "greeting"
        ? buildGreetingPrompt(initialMessage.location)
        : initialMessage.text;
    void sendMessage({ text });
  }, [sendMessage, initialMessage]);

  const value = useMemo<ChatContextValue>(
    () => ({
      threadId,
      messages,
      status,
      error,
      isRunning: status === "submitted" || status === "streaming",
      sendMessage: (message) => {
        void sendMessage(message);
      },
      stop: () => {
        void stop();
      },
    }),
    [threadId, messages, status, error, sendMessage, stop],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { type ReactNode, useEffect, useMemo, useRef } from "react";

import { API_BASE } from "~/lib/api/client";
import { getBearerToken } from "~/lib/auth-token";
import { getLocationParam } from "~/lib/location-param";

import { getMessageContent } from "../feedback-helpers";
import { buildGreetingPrompt, isGreetingPrompt } from "../greeting-prompt";
import { ChatContext, type ChatContextValue } from "./ChatContext";

export type InitialMessage =
  | { type: "greeting" }
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
      new DefaultChatTransport({
        api: `${API_BASE}/threads/${threadId}/chat`,
        headers: (): Record<string, string> => {
          const token = getBearerToken();
          if (token) {
            return { Authorization: `Bearer ${token}` };
          }
          return {};
        },
        prepareSendMessagesRequest({ messages }) {
          const lastMessage = messages[messages.length - 1];
          const lastText = lastMessage ? getMessageContent(lastMessage) : "";
          const intent = isGreetingPrompt(lastText) ? "casual" : undefined;
          return {
            body: {
              message: lastMessage,
              intent,
            },
          };
        },
      }),
    [threadId],
  );

  const { messages, status, error, sendMessage, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });

  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !initialMessage) return;
    sent.current = true;
    const text =
      initialMessage.type === "greeting"
        ? buildGreetingPrompt(getLocationParam())
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

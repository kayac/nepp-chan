import type { ChatStatus, UIMessage } from "ai";
import { createContext, useContext } from "react";

export type ChatContextValue = {
  threadId: string;
  messages: UIMessage[];
  status: ChatStatus;
  error: Error | undefined;
  isRunning: boolean;
  sendMessage: (message: { text: string }) => void;
  stop: () => void;
};

export const ChatContext = createContext<ChatContextValue | null>(null);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within ChatProvider");
  }
  return context;
};

// design-sync 用エントリ: web パッケージのコンポーネントを DS バンドルへ再エクスポートする
import type { UIMessage } from "ai";
import type { ReactNode } from "react";

import { ChatContext } from "../web/src/app/chat/contexts/ChatContext";

export { Dialog } from "../web/src/components/ui/Dialog";
export { ModalHeader } from "../web/src/components/ui/ModalHeader";
export { RatingBadge } from "../web/src/components/ui/RatingBadge";
export { Landing } from "../web/src/app/chat/components/Landing";
export { TopBar } from "../web/src/app/chat/components/TopBar";
export { ThreadSidebar } from "../web/src/app/chat/components/ThreadSidebar";
export { ChatStandingMascot } from "../web/src/app/chat/components/ChatStandingMascot";
export { FeedbackModal } from "../web/src/app/chat/components/FeedbackModal";
export { UserMessage } from "../web/src/components/chat/UserMessage";
export {
  AssistantMessage,
  PendingAssistantMessage,
} from "../web/src/components/chat/AssistantMessage";
export { Composer } from "../web/src/components/chat/Composer";
export { Thread } from "../web/src/components/chat/Thread";
export { MarkdownText } from "../web/src/components/chat/MarkdownText";
export { MessageParts } from "../web/src/components/chat/MessageParts";
export { ToolFallback } from "../web/src/components/chat/ToolFallback";
export { ToolPart } from "../web/src/components/chat/ToolPart";
export { ChoiceBar } from "../web/src/app/poll/components/ChoiceBar";

const mockMessages: UIMessage[] = [
  {
    id: "msg-user-1",
    role: "user",
    parts: [{ type: "text", text: "おといねっぷ美術工芸高校について教えて！" }],
  },
  {
    id: "msg-assistant-1",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "おといねっぷ美術工芸高校は、音威子府村にある村立の高校だよ！工芸科があって、全国から木工やデザインを学びたい生徒が集まってくるんだ🌲 寮生活をしながらものづくりに打ち込める、ちょっと特別な学校なんだよ✨",
      },
    ],
  },
];

// プレビュー描画用: ChatContext 依存コンポーネントに静的なモック値を供給する
export const ChatPreviewProvider = ({ children }: { children: ReactNode }) => (
  <ChatContext.Provider
    value={{
      threadId: "preview-thread",
      messages: mockMessages,
      status: "ready",
      error: undefined,
      isRunning: false,
      sendMessage: () => {},
      stop: () => {},
    }}
  >
    {children}
  </ChatContext.Provider>
);

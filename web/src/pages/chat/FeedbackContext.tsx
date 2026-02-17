import { useThreadRuntime } from "@assistant-ui/react";
import type { UIMessage } from "ai";
import { isToolOrDynamicToolUIPart } from "ai";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

import { submitFeedback } from "~/repository/feedback-repository";
import type {
  ConversationContext,
  FeedbackCategory,
  FeedbackRating,
  ToolExecution,
} from "~/types";

type FeedbackModalState = {
  isOpen: boolean;
  messageId: string;
  rating: FeedbackRating;
};

type FeedbackContextValue = {
  feedbackModal: FeedbackModalState | null;
  isSubmitting: boolean;
  onFeedbackClick: (messageId: string, rating: FeedbackRating) => void;
  onFeedbackSubmit: (data: {
    category?: FeedbackCategory;
    comment?: string;
  }) => Promise<void>;
  onFeedbackModalClose: () => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return context;
};

const getMessageContent = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

const getToolNameFromPart = (part: { type: string; toolName?: string }) => {
  if ("toolName" in part && part.toolName) return part.toolName;
  const match = part.type.match(/^tool-(.+)$/);
  return match ? match[1] : part.type;
};

const extractConversationContext = (
  messages: UIMessage[],
  targetMessageId: string,
): ConversationContext | null => {
  const targetIndex = messages.findIndex((m) => m.id === targetMessageId);
  if (targetIndex === -1) return null;

  const targetMessage = messages[targetIndex];
  const previousMessage =
    targetIndex > 0 ? messages[targetIndex - 1] : undefined;

  return {
    targetMessage: {
      id: targetMessage.id,
      role: targetMessage.role,
      content: getMessageContent(targetMessage),
    },
    previousMessages: previousMessage
      ? [
          {
            id: previousMessage.id,
            role: previousMessage.role,
            content: getMessageContent(previousMessage),
          },
        ]
      : [],
    nextMessages: [],
  };
};

const extractToolExecutions = (message: UIMessage): ToolExecution[] =>
  message.parts.filter(isToolOrDynamicToolUIPart).map((part) => ({
    toolName: getToolNameFromPart(part),
    state: part.state ?? "unknown",
    input: "input" in part ? part.input : undefined,
    output: "output" in part ? part.output : undefined,
    errorText: "errorText" in part ? (part.errorText as string) : undefined,
  }));

/**
 * assistant-ui の ThreadMessage を UIMessage に変換
 */
const convertToUIMessages = (
  threadMessages: readonly {
    id: string;
    role: string;
    content: readonly unknown[];
  }[],
): UIMessage[] =>
  threadMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: m.content.map((c) => {
        if (typeof c === "object" && c !== null && "type" in c) {
          const content = c as {
            type: string;
            text?: string;
            [key: string]: unknown;
          };
          if (content.type === "text") {
            return { type: "text" as const, text: content.text ?? "" };
          }
          if (content.type === "tool-call") {
            return c as UIMessage["parts"][number];
          }
        }
        return { type: "text" as const, text: String(c) };
      }),
    }));

interface Props {
  children: ReactNode;
  threadId: string;
}

export const FeedbackProvider = ({ children, threadId }: Props) => {
  const threadRuntime = useThreadRuntime();

  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onFeedbackClick = useCallback(
    (messageId: string, rating: FeedbackRating) => {
      setFeedbackModal({ isOpen: true, messageId, rating });
    },
    [],
  );

  const onFeedbackSubmit = useCallback(
    async (data: { category?: FeedbackCategory; comment?: string }) => {
      if (!feedbackModal || !threadId) return;

      const threadMessages = threadRuntime.getState().messages;
      const messages = convertToUIMessages(threadMessages);

      const targetMessage = messages.find(
        (m) => m.id === feedbackModal.messageId,
      );
      if (!targetMessage) {
        console.error("Target message not found:", feedbackModal.messageId);
        return;
      }

      const conversationContext = extractConversationContext(
        messages,
        feedbackModal.messageId,
      );
      if (!conversationContext) return;

      const toolExecutions = extractToolExecutions(targetMessage);

      setIsSubmitting(true);
      try {
        await submitFeedback({
          threadId,
          messageId: feedbackModal.messageId,
          rating: feedbackModal.rating,
          category: data.category,
          comment: data.comment,
          conversationContext,
          toolExecutions:
            toolExecutions.length > 0 ? toolExecutions : undefined,
        });

        setFeedbackModal(null);
      } catch (err) {
        console.error("Failed to submit feedback:", err);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [feedbackModal, threadId, threadRuntime],
  );

  const onFeedbackModalClose = useCallback(() => {
    setFeedbackModal(null);
  }, []);

  return (
    <FeedbackContext.Provider
      value={{
        feedbackModal,
        isSubmitting,
        onFeedbackClick,
        onFeedbackSubmit,
        onFeedbackModalClose,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
};

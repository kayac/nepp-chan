import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

import { feedbackRepository } from "~/lib/api/repository";
import type { FeedbackCategory, FeedbackRating } from "~/types";

import {
  extractConversationContext,
  extractToolExecutions,
} from "./feedback-helpers";
import { useChatContext } from "./useChatContext";

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

interface Props {
  children: ReactNode;
  threadId: string;
}

export const FeedbackProvider = ({ children, threadId }: Props) => {
  const { messages } = useChatContext();

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
        await feedbackRepository.submitFeedback({
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
    [feedbackModal, threadId, messages],
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

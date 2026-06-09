import { useCallback, useState } from "react";
import { useChatContext } from "~/app/chat/contexts/ChatContext";
import {
  extractConversationContext,
  extractToolExecutions,
} from "~/app/chat/feedback-helpers";
import { feedbackRepository } from "~/lib/api/repository";
import type { FeedbackCategory, FeedbackRating } from "~/types";

type SubmitData = {
  category?: FeedbackCategory;
  comment?: string;
};

export const useSubmitFeedback = () => {
  const { threadId, messages } = useChatContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(
    async (messageId: string, rating: FeedbackRating, data: SubmitData) => {
      const targetMessage = messages.find((m) => m.id === messageId);
      if (!targetMessage) {
        console.error("Target message not found:", messageId);
        return;
      }

      const conversationContext = extractConversationContext(
        messages,
        messageId,
      );
      if (!conversationContext) return;

      const toolExecutions = extractToolExecutions(targetMessage);

      setIsSubmitting(true);
      try {
        await feedbackRepository.submitFeedback({
          threadId,
          messageId,
          rating,
          category: data.category,
          comment: data.comment,
          conversationContext,
          toolExecutions:
            toolExecutions.length > 0 ? toolExecutions : undefined,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [threadId, messages],
  );

  return { submit, isSubmitting };
};

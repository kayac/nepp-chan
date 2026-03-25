import type { z } from "zod";
import type { MessageFeedback } from "~/db";
import type {
  conversationContextSchema,
  feedbackFullSchema,
  toolExecutionSchema,
} from "~/schemas/feedback-schema";

type FeedbackFull = z.infer<typeof feedbackFullSchema>;
type ConversationContext = z.infer<typeof conversationContextSchema>;
type ToolExecution = z.infer<typeof toolExecutionSchema>;

const safeParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

const defaultConversationContext: ConversationContext = {
  targetMessage: { id: "", role: "", content: "" },
  previousMessages: [],
  nextMessages: [],
};

export const parseFeedback = (f: MessageFeedback): FeedbackFull => ({
  ...f,
  rating: f.rating as FeedbackFull["rating"],
  category: f.category as FeedbackFull["category"],
  conversationContext: safeParse<ConversationContext>(
    f.conversationContext,
    defaultConversationContext,
  ),
  toolExecutions: f.toolExecutions
    ? safeParse<ToolExecution[]>(f.toolExecutions, [])
    : null,
});

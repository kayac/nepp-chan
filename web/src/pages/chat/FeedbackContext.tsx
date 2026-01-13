import { createContext, type ReactNode, useContext } from "react";

import type { FeedbackRating } from "~/types";

type FeedbackContextValue = {
  submittedFeedbacks: Record<string, FeedbackRating>;
  onFeedbackClick: (messageId: string, rating: FeedbackRating) => void;
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
  submittedFeedbacks: Record<string, FeedbackRating>;
  onFeedbackClick: (messageId: string, rating: FeedbackRating) => void;
}

export const FeedbackProvider = ({
  children,
  submittedFeedbacks,
  onFeedbackClick,
}: Props) => (
  <FeedbackContext.Provider value={{ submittedFeedbacks, onFeedbackClick }}>
    {children}
  </FeedbackContext.Provider>
);

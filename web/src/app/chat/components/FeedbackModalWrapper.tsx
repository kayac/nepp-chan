import { useFeedback } from "~/app/chat/FeedbackContext";
import { FeedbackModal } from "./FeedbackModal";

export const FeedbackModalWrapper = () => {
  const {
    feedbackModal,
    isSubmitting,
    onFeedbackSubmit,
    onFeedbackModalClose,
  } = useFeedback();

  if (!feedbackModal) return null;

  return (
    <FeedbackModal
      isOpen={feedbackModal.isOpen}
      onClose={onFeedbackModalClose}
      rating={feedbackModal.rating}
      onSubmit={onFeedbackSubmit}
      isSubmitting={isSubmitting}
    />
  );
};

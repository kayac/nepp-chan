import {
  HandThumbDownIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";
import type { FeedbackRating } from "~/types";

type Props = {
  onFeedback: (rating: FeedbackRating) => void;
  submittedRating?: FeedbackRating | null;
  disabled?: boolean;
};

export const FeedbackButton = ({
  onFeedback,
  submittedRating,
  disabled = false,
}: Props) => {
  const isGoodSelected = submittedRating === "good";
  const isBadSelected = submittedRating === "bad";
  const hasSubmitted = submittedRating != null;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onFeedback("good")}
        disabled={disabled || hasSubmitted}
        className={`
          p-1.5 rounded-md text-sm transition-all
          ${
            isGoodSelected
              ? "bg-green-100 text-green-700"
              : "text-(--color-text-muted) hover:text-green-600 hover:bg-green-50"
          }
          ${hasSubmitted && !isGoodSelected ? "opacity-40" : ""}
          disabled:cursor-not-allowed
        `}
        title="良い回答"
      >
        <HandThumbUpIcon className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onFeedback("bad")}
        disabled={disabled || hasSubmitted}
        className={`
          p-1.5 rounded-md text-sm transition-all
          ${
            isBadSelected
              ? "bg-red-100 text-red-700"
              : "text-(--color-text-muted) hover:text-red-600 hover:bg-red-50"
          }
          ${hasSubmitted && !isBadSelected ? "opacity-40" : ""}
          disabled:cursor-not-allowed
        `}
        title="改善が必要"
      >
        <HandThumbDownIcon className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
};

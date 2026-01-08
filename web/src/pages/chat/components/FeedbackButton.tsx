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
              : "text-[var(--color-text-muted)] hover:text-green-600 hover:bg-green-50"
          }
          ${hasSubmitted && !isGoodSelected ? "opacity-40" : ""}
          disabled:cursor-not-allowed
        `}
        title="良い回答"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0H22.5a2.25 2.25 0 0 1 0 4.5h-2.25m-10.5 0v6.75a2.25 2.25 0 0 0 2.25 2.25h8.25a2.25 2.25 0 0 0 2.25-2.25v-.75m-18 0h3.75m0-9H6.75m6-4.5v1.5M3.75 18.75h6m-6 0v-9m0 9v1.5m0-10.5h2.25m-2.25 0V8.25m9.75 0v.75"
          />
        </svg>
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
              : "text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50"
          }
          ${hasSubmitted && !isBadSelected ? "opacity-40" : ""}
          disabled:cursor-not-allowed
        `}
        title="改善が必要"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 0L5.36 20.25H3.75m13.5-15h.008v.008h-.008V5.25Zm0 0H21a2.25 2.25 0 0 1 0 4.5h-2.25"
          />
        </svg>
      </button>
    </div>
  );
};

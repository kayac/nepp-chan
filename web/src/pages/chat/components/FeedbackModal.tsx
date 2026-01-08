import { useState } from "react";

import type { FeedbackCategory, FeedbackRating } from "~/types";

const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "incorrect_fact", label: "事実と異なる" },
  { value: "outdated_info", label: "情報が古い" },
  { value: "nonexistent_info", label: "存在しない情報" },
  { value: "off_topic", label: "質問に答えていない" },
  { value: "other", label: "その他" },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  rating: FeedbackRating;
  onSubmit: (data: { category?: FeedbackCategory; comment?: string }) => void;
  isSubmitting: boolean;
};

export const FeedbackModal = ({
  isOpen,
  onClose,
  rating,
  onSubmit,
  isSubmitting,
}: Props) => {
  const [category, setCategory] = useState<FeedbackCategory | undefined>(
    undefined,
  );
  const [comment, setComment] = useState("");

  const isBadRating = rating === "bad";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      category: isBadRating ? category : undefined,
      comment: comment.trim() || undefined,
    });
  };

  const handleClose = () => {
    setCategory(undefined);
    setComment("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 cursor-default"
        onClick={handleClose}
        aria-label="閉じる"
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            {rating === "good" ? "フィードバック" : "改善点を教えてください"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-md"
            aria-label="閉じる"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            className={`mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              rating === "good"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {rating === "good" ? (
              <>
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
                良い回答
              </>
            ) : (
              <>
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
                改善が必要
              </>
            )}
          </div>

          {isBadRating && (
            <fieldset className="mb-4">
              <legend className="block text-sm font-medium text-[var(--color-text)] mb-2">
                改善点のカテゴリ
              </legend>
              <div className="space-y-2">
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <label
                    key={cat.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="category"
                      value={cat.value}
                      checked={category === cat.value}
                      onChange={() => setCategory(cat.value)}
                      className="sr-only"
                    />
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        category === cat.value
                          ? "border-stone-700 bg-stone-700"
                          : "border-stone-400 bg-white"
                      }`}
                    >
                      {category === cat.value && (
                        <span className="w-1.5 h-1.5 bg-white rounded-full" />
                      )}
                    </span>
                    <span className="text-sm text-[var(--color-text)]">
                      {cat.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mb-6">
            <label
              htmlFor="feedback-comment"
              className="block text-sm font-medium text-[var(--color-text)] mb-2"
            >
              コメント（任意）
            </label>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                rating === "good"
                  ? "どこが良かったか教えてください"
                  : "具体的にどう改善できるか教えてください"
              }
              maxLength={1000}
              rows={3}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent resize-none"
            />
            <div className="text-xs text-[var(--color-text-muted)] mt-1 text-right">
              {comment.length}/1000
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 border border-[var(--color-border)] text-[var(--color-text)] rounded-lg text-sm font-medium hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (isBadRating && !category)}
              className="flex-1 py-2.5 px-4 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "送信中..." : "送信"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

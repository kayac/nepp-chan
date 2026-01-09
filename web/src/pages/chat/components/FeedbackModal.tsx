import {
  HandThumbDownIcon,
  HandThumbUpIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
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
          <h2 className="text-lg font-bold text-(--color-text)">
            {rating === "good" ? "フィードバック" : "改善点を教えてください"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-(--color-text-muted) hover:text-(--color-text) rounded-md"
            aria-label="閉じる"
          >
            <XMarkIcon className="w-5 h-5" aria-hidden="true" />
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
                <HandThumbUpIcon className="w-4 h-4" aria-hidden="true" />
                良い回答
              </>
            ) : (
              <>
                <HandThumbDownIcon className="w-4 h-4" aria-hidden="true" />
                改善が必要
              </>
            )}
          </div>

          {isBadRating && (
            <fieldset className="mb-4">
              <legend className="block text-sm font-medium text-(--color-text) mb-2">
                どこが問題でしたか？
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
                    <span className="text-sm text-(--color-text)">
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
              className="block text-sm font-medium text-(--color-text) mb-2"
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
                  : "問題点を教えてください"
              }
              maxLength={1000}
              rows={3}
              className="w-full px-3 py-2 border border-(--color-border) rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--color-accent) focus:border-transparent resize-none"
            />
            <div className="text-xs text-(--color-text-muted) mt-1 text-right">
              {comment.length}/1000
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 border border-(--color-border) text-(--color-text) rounded-lg text-sm font-medium hover:bg-(--color-surface) transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (isBadRating && !category)}
              className="flex-1 py-2.5 px-4 bg-(--color-accent) text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "送信中..." : "送信"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

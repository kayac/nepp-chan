import {
  HandThumbDownIcon,
  HandThumbUpIcon,
  LightBulbIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@nepp-chan/shared/ui/Button";
import { type SubmitEvent, useState } from "react";

import { useSubmitFeedback } from "~/app/chat/hooks/useSubmitFeedback";
import { Dialog } from "~/components/ui/Dialog";
import { ModalHeader } from "~/components/ui/ModalHeader";
import type { FeedbackCategory, FeedbackRating } from "~/types";

const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "incorrect_fact", label: "事実と異なる" },
  { value: "outdated_info", label: "情報が古い" },
  { value: "nonexistent_info", label: "存在しない情報" },
  { value: "off_topic", label: "質問に答えていない" },
  { value: "other", label: "その他" },
];

type Props = {
  messageId: string;
  rating: FeedbackRating;
  onClose: () => void;
};

export const FeedbackModal = ({ messageId, rating, onClose }: Props) => {
  const { submit, isSubmitting } = useSubmitFeedback();
  const [category, setCategory] = useState<FeedbackCategory | undefined>(
    undefined,
  );
  const [comment, setComment] = useState("");

  const isBadRating = rating === "bad";

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await submit(messageId, rating, {
        category: isBadRating ? category : undefined,
        comment: comment.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    }
  };

  return (
    <Dialog onClose={onClose} className="w-full max-w-md">
      <div className="relative bg-(--bg-raised) rounded-xl shadow-xl mx-4 p-6 animate-fade-in">
        <ModalHeader
          className="mb-4"
          titleClassName="text-lg"
          onClose={onClose}
          title={
            rating === "good"
              ? "フィードバック"
              : rating === "idea"
                ? "改善要望"
                : "改善点を教えてください"
          }
        />

        <form onSubmit={handleSubmit}>
          <div
            className={`mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              rating === "good"
                ? "bg-(--success-bg) text-(--success)"
                : rating === "idea"
                  ? "bg-(--warning-bg) text-(--warning)"
                  : "bg-(--danger-bg) text-(--danger)"
            }`}
          >
            {rating === "good" ? (
              <>
                <HandThumbUpIcon className="w-4 h-4" aria-hidden="true" />
                良い回答
              </>
            ) : rating === "idea" ? (
              <>
                <LightBulbIcon className="w-4 h-4" aria-hidden="true" />
                アイデア
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
              <legend className="block text-sm font-medium text-(--fg-1) mb-2">
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
                          ? "border-(--fg-1) bg-(--fg-1)"
                          : "border-(--border-2) bg-(--bg-raised)"
                      }`}
                    >
                      {category === cat.value && (
                        <span className="w-1.5 h-1.5 bg-(--paper-0) rounded-full" />
                      )}
                    </span>
                    <span className="text-sm text-(--fg-1)">{cat.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mb-6">
            <label
              htmlFor="feedback-comment"
              className="block text-sm font-medium text-(--fg-1) mb-2"
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
                  : rating === "idea"
                    ? "ねっぷちゃんをもっと良くするアイデアを教えてください！"
                    : "問題点を教えてください"
              }
              maxLength={1000}
              rows={3}
              className="w-full px-3 py-2 border border-(--border-1) rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--brand) focus:border-transparent resize-none"
            />
            <div className="text-xs text-(--fg-3) mt-1 text-right">
              {comment.length}/1000
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5"
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (isBadRating && !category)}
              className="flex-1 py-2.5"
            >
              {isSubmitting ? "送信中..." : "送信"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
};

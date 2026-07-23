import {
  HandThumbDownIcon,
  HandThumbUpIcon,
  LightBulbIcon,
} from "@heroicons/react/24/outline";
import type { FeedbackRating } from "~/types";

const RATING_STYLE: Record<
  FeedbackRating,
  { className: string; icon: typeof HandThumbUpIcon; label: string }
> = {
  good: {
    className: "bg-(--success-bg) text-(--success)",
    icon: HandThumbUpIcon,
    label: "良い回答",
  },
  idea: {
    className: "bg-(--warning-bg) text-(--warning)",
    icon: LightBulbIcon,
    label: "アイデア",
  },
  bad: {
    className: "bg-(--danger-bg) text-(--danger)",
    icon: HandThumbDownIcon,
    label: "改善が必要",
  },
};

type Props = {
  rating: FeedbackRating;
};

export const RatingBadge = ({ rating }: Props) => {
  const { className, icon: Icon, label } = RATING_STYLE[rating];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${className}`}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      {label}
    </span>
  );
};

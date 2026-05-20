import type { PollChoiceResult } from "~/types";

type Props = PollChoiceResult & { isLeading: boolean };

export const ChoiceBar = ({ choice, count, percentage, isLeading }: Props) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm font-medium text-stone-700 truncate">
        {choice}
      </span>
      <span className="text-sm tabular-nums shrink-0 text-stone-500">
        {count}票
      </span>
    </div>
    <div className="h-9 bg-stone-100 rounded-lg overflow-hidden relative">
      <div
        className={`h-full rounded-lg ${isLeading ? "bg-(--teal-500)" : "bg-(--teal-300)"}`}
        style={{ width: `${Math.max(percentage, 2)}%` }}
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-600 tabular-nums">
        {percentage}%
      </span>
    </div>
  </div>
);

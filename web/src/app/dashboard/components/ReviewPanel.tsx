import { useState } from "react";
import {
  type DecidedFilter,
  flagLabels,
  primaryQuery,
  REVIEW_DECISION_LABELS,
  toDecidedParam,
} from "~/app/dashboard/components/review/helpers";
import { ReviewDetailModal } from "~/app/dashboard/components/review/ReviewDetailModal";
import { useInfiniteScroll } from "~/app/dashboard/hooks/useInfiniteScroll";
import { useReviewQueue } from "~/app/dashboard/hooks/useReview";
import { EmptyStateCard } from "~/components/ui/EmptyStateCard";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import { PanelLoading } from "~/components/ui/PanelLoading";
import { formatDateTime } from "~/lib/format";

const FILTERS: Array<{ value: DecidedFilter; label: string }> = [
  { value: "undecided", label: "未判断" },
  { value: "decided", label: "判断済み" },
  { value: "all", label: "すべて" },
];

export const ReviewPanel = () => {
  const [filter, setFilter] = useState<DecidedFilter>("undecided");
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useReviewQueue(30, { decided: toDecidedParam(filter) });
  const [selectedAnswerRunId, setSelectedAnswerRunId] = useState<string | null>(
    null,
  );
  const loadMoreRef = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    isFetching: isFetchingNextPage,
    onFetch: fetchNextPage,
  });

  if (isLoading) {
    return <PanelLoading />;
  }

  if (error) {
    return <ErrorBanner>{formatError(error)}</ErrorBanner>;
  }

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
              filter === option.value
                ? "bg-stone-800 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyStateCard>要確認の回答はありません</EmptyStateCard>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-auto max-h-[70dvh]">
          <div
            className="grid text-sm"
            style={{
              gridTemplateColumns:
                "minmax(6rem, auto) 1fr minmax(8rem, auto) minmax(6rem, auto) minmax(3rem, auto)",
            }}
          >
            <div className="contents hidden md:[display:contents] font-medium text-stone-600 text-xs">
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                日時
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                検索クエリ
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                シグナル
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                判断
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                詳細
              </div>
            </div>

            {items.map((item) => (
              <div
                key={item.answerRunId}
                className={`contents md:hover:[&>div]:bg-stone-50 ${item.decision ? "[&>div]:opacity-60" : ""}`}
              >
                <div className="col-span-full md:col-span-1 px-4 pt-3 md:py-3 md:border-b md:border-stone-100 text-stone-500 text-xs whitespace-nowrap">
                  {formatDateTime(item.createdAt)}
                </div>
                <div className="col-span-full md:col-span-1 px-4 py-1 md:py-3 md:border-b md:border-stone-100 text-stone-700">
                  <p className="truncate md:max-w-md">
                    {primaryQuery(item.queries)}
                  </p>
                  {item.searchCount > 1 && (
                    <span className="text-xs text-stone-400">
                      他 {item.searchCount - 1} 回の検索
                    </span>
                  )}
                </div>
                <div className="col-span-full md:col-span-1 px-4 py-1 md:py-3 md:border-b md:border-stone-100 flex flex-wrap gap-1">
                  {flagLabels(item.flags).map((label) => (
                    <span
                      key={label}
                      className="inline-flex px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded"
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <div className="hidden md:block px-4 py-3 border-b border-stone-100 text-xs text-stone-600 whitespace-nowrap">
                  {item.decision
                    ? (REVIEW_DECISION_LABELS[item.decision] ?? item.decision)
                    : "未判断"}
                </div>
                <div className="col-span-full md:col-span-1 px-4 pb-3 md:py-3 md:border-b md:border-stone-100">
                  <button
                    type="button"
                    onClick={() => setSelectedAnswerRunId(item.answerRunId)}
                    className="text-teal-600 hover:text-teal-700 hover:underline text-sm"
                  >
                    詳細
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div ref={loadMoreRef} className="py-4 text-center">
            {isFetchingNextPage && (
              <div className="text-stone-500 text-sm">読み込み中...</div>
            )}
            {!hasNextPage && items.length > 0 && (
              <div className="text-stone-400 text-sm">
                すべての要確認回答を表示しました
              </div>
            )}
          </div>
        </div>
      )}

      {selectedAnswerRunId && (
        <ReviewDetailModal
          answerRunId={selectedAnswerRunId}
          onClose={() => setSelectedAnswerRunId(null)}
        />
      )}
    </div>
  );
};

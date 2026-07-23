import {
  CheckIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  LightBulbIcon,
} from "@heroicons/react/24/solid";
import { useState } from "react";
import { FeedbackDetailModal } from "~/app/dashboard/components/feedback/FeedbackDetailModal";
import {
  countResolvedAndUnresolved,
  filterFeedbacksByResolved,
  type ResolvedFilter,
} from "~/app/dashboard/components/feedback/helpers";
import {
  useDeleteFeedbacks,
  useFeedbacks,
  useResolveFeedback,
  useUnresolveFeedback,
} from "~/app/dashboard/hooks/useFeedback";
import { useInfiniteScroll } from "~/app/dashboard/hooks/useInfiniteScroll";
import { EmptyStateCard } from "~/components/ui/EmptyStateCard";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import { PanelLoading } from "~/components/ui/PanelLoading";
import { confirmDialog } from "~/lib/dialog";
import { formatDateTime } from "~/lib/format";
import {
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
  type MessageFeedback,
} from "~/types";

export const FeedbackPanel = () => {
  const [ratingFilter, setRatingFilter] = useState<
    "good" | "bad" | "idea" | undefined
  >(undefined);
  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter>("all");
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeedbacks(30, { rating: ratingFilter });
  const deleteMutation = useDeleteFeedbacks();
  const resolveMutation = useResolveFeedback();
  const unresolveMutation = useUnresolveFeedback();
  const [selectedFeedback, setSelectedFeedback] =
    useState<MessageFeedback | null>(null);
  const loadMoreRef = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    isFetching: isFetchingNextPage,
    onFetch: fetchNextPage,
  });

  const handleDelete = () => {
    if (
      !confirmDialog(
        "全てのフィードバックを削除しますか？この操作は取り消せません。",
      )
    ) {
      return;
    }
    deleteMutation.mutate();
  };

  if (isLoading) {
    return <PanelLoading />;
  }

  if (error) {
    return <ErrorBanner>{formatError(error)}</ErrorBanner>;
  }

  const allFeedbacks = data?.pages.flatMap((page) => page.feedbacks) ?? [];
  const feedbacks = filterFeedbacksByResolved(allFeedbacks, resolvedFilter);
  const stats = data?.pages[0]?.stats;
  const total = data?.pages[0]?.total ?? 0;
  const { unresolved: unresolvedCount, resolved: resolvedCount } =
    countResolvedAndUnresolved(allFeedbacks);

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
          <div className="bg-white rounded-xl border border-stone-200 p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-stone-800">
              {stats.total}
            </div>
            <div className="text-xs sm:text-sm text-stone-500">総数</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {stats.good}
            </div>
            <div className="text-xs sm:text-sm text-stone-500">Good</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-red-600">
              {stats.bad}
            </div>
            <div className="text-xs sm:text-sm text-stone-500">Bad</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-amber-600">
              {stats.idea}
            </div>
            <div className="text-xs sm:text-sm text-stone-500">Idea</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-stone-800">
              {stats.total > 0
                ? `${Math.round((stats.good / stats.total) * 100)}%`
                : "-"}
            </div>
            <div className="text-xs sm:text-sm text-stone-500">満足率</div>
          </div>
        </div>
      )}

      {stats && Object.keys(stats.byCategory).length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <h3 className="text-sm font-medium text-stone-700 mb-3">
            改善カテゴリ別内訳
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byCategory).map(([category, count]) => (
              <span
                key={category}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-700 rounded-full text-sm"
              >
                {FEEDBACK_CATEGORY_LABELS[category as FeedbackCategory] ||
                  category}
                <span className="font-medium">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-stone-500">
            {feedbacks.length} / {total}件のフィードバック
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending || allFeedbacks.length === 0}
            className="sm:order-last px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {deleteMutation.isPending ? "削除中..." : "全て削除"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => {
              setRatingFilter(undefined);
              setResolvedFilter("all");
            }}
            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
              ratingFilter === undefined && resolvedFilter === "all"
                ? "bg-stone-800 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            すべて
          </button>
          <button
            type="button"
            onClick={() => setRatingFilter("good")}
            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
              ratingFilter === "good"
                ? "bg-green-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Good
          </button>
          <button
            type="button"
            onClick={() => setRatingFilter("bad")}
            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
              ratingFilter === "bad"
                ? "bg-red-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Bad
          </button>
          <button
            type="button"
            onClick={() => setRatingFilter("idea")}
            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
              ratingFilter === "idea"
                ? "bg-amber-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Idea
          </button>
          <span className="w-px h-6 bg-stone-200 mx-1 hidden sm:block self-center" />
          <button
            type="button"
            onClick={() => setResolvedFilter("unresolved")}
            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
              resolvedFilter === "unresolved"
                ? "bg-amber-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            未解決 ({unresolvedCount})
          </button>
          <button
            type="button"
            onClick={() => setResolvedFilter("resolved")}
            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
              resolvedFilter === "resolved"
                ? "bg-teal-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            解決済み ({resolvedCount})
          </button>
        </div>
      </div>

      {deleteMutation.isError && (
        <ErrorBanner>
          {deleteMutation.error?.message || "フィードバック削除に失敗しました"}
        </ErrorBanner>
      )}

      {feedbacks.length === 0 ? (
        <EmptyStateCard>フィードバックデータがありません</EmptyStateCard>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-auto max-h-[70dvh]">
          <div
            className="grid text-sm"
            style={{
              gridTemplateColumns:
                "minmax(4rem, auto) minmax(4rem, auto) 1fr minmax(6rem, auto) minmax(5rem, auto) minmax(3rem, auto)",
            }}
          >
            <div className="contents hidden md:[display:contents] font-medium text-stone-600 text-xs">
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                評価
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                カテゴリ
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                コメント
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                日時
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                ステータス
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                詳細
              </div>
            </div>

            {feedbacks.map((feedback) => {
              const isResolved = !!feedback.resolvedAt;
              const ratingBadge = (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
                    feedback.rating === "good"
                      ? "bg-green-100 text-green-700"
                      : feedback.rating === "idea"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {feedback.rating === "good" ? (
                    <>
                      <HandThumbUpIcon className="w-3.5 h-3.5" />
                      Good
                    </>
                  ) : feedback.rating === "idea" ? (
                    <>
                      <LightBulbIcon className="w-3.5 h-3.5" />
                      Idea
                    </>
                  ) : (
                    <>
                      <HandThumbDownIcon className="w-3.5 h-3.5" />
                      Bad
                    </>
                  )}
                </span>
              );
              const statusButton = (
                <button
                  type="button"
                  onClick={() => {
                    if (isResolved) {
                      unresolveMutation.mutate(feedback.id);
                    } else {
                      resolveMutation.mutate(feedback.id);
                    }
                  }}
                  disabled={
                    resolveMutation.isPending || unresolveMutation.isPending
                  }
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    isResolved
                      ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  } disabled:opacity-50`}
                >
                  {isResolved ? (
                    <>
                      <CheckIcon className="w-3 h-3" />
                      解決済み
                    </>
                  ) : (
                    "未解決"
                  )}
                </button>
              );

              return (
                <div
                  key={feedback.id}
                  className={`contents md:hover:[&>div]:bg-stone-50 ${isResolved ? "[&>div]:opacity-60" : ""}`}
                >
                  <div className="col-span-full md:col-span-1 px-4 pt-3 md:py-3 md:border-b md:border-stone-100 flex flex-wrap items-center gap-2">
                    {ratingBadge}
                    {feedback.category && (
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-stone-100 text-stone-600 rounded md:hidden">
                        {FEEDBACK_CATEGORY_LABELS[feedback.category] ||
                          feedback.category}
                      </span>
                    )}
                    <span className="text-xs text-stone-400 whitespace-nowrap ml-auto md:hidden">
                      {formatDateTime(feedback.createdAt)}
                    </span>
                  </div>
                  <div className="hidden md:block px-4 py-3 text-stone-600 text-xs border-b border-stone-100">
                    {feedback.category
                      ? FEEDBACK_CATEGORY_LABELS[feedback.category] ||
                        feedback.category
                      : "-"}
                  </div>
                  <div className="col-span-full md:col-span-1 px-4 py-1 md:py-3 md:border-b md:border-stone-100 text-stone-700">
                    {feedback.comment ? (
                      <p className="line-clamp-3 md:line-clamp-none md:truncate md:max-w-md">
                        {feedback.comment}
                      </p>
                    ) : (
                      <span className="hidden md:inline text-stone-400">-</span>
                    )}
                  </div>
                  <div className="hidden md:block px-4 py-3 text-stone-500 text-xs whitespace-nowrap border-b border-stone-100">
                    {formatDateTime(feedback.createdAt)}
                  </div>
                  <div className="hidden md:block px-4 py-3 border-b border-stone-100">
                    {statusButton}
                  </div>
                  <div className="hidden md:block px-4 py-3 border-b border-stone-100">
                    <button
                      type="button"
                      onClick={() => setSelectedFeedback(feedback)}
                      className="text-teal-600 hover:text-teal-700 hover:underline text-sm"
                    >
                      詳細
                    </button>
                  </div>
                  <div className="col-span-full md:hidden px-4 pb-3 flex items-center justify-between pt-2 border-b border-stone-100">
                    {statusButton}
                    <button
                      type="button"
                      onClick={() => setSelectedFeedback(feedback)}
                      className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                    >
                      詳細を見る
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div ref={loadMoreRef} className="py-4 text-center">
            {isFetchingNextPage && (
              <div className="text-stone-500 text-sm">読み込み中...</div>
            )}
            {!hasNextPage && feedbacks.length > 0 && (
              <div className="text-stone-400 text-sm">
                すべてのフィードバックを表示しました
              </div>
            )}
          </div>
        </div>
      )}

      {selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          onClose={() => setSelectedFeedback(null)}
        />
      )}
    </div>
  );
};

import { useEffect, useRef, useState } from "react";

import {
  useDeleteFeedbacks,
  useFeedbacks,
  useResolveFeedback,
  useUnresolveFeedback,
} from "~/hooks/useDashboard";
import type {
  ConversationContext,
  FeedbackCategory,
  MessageFeedback,
  ToolExecution,
} from "~/types";

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  incorrect_fact: "事実と異なる",
  outdated_info: "情報が古い",
  nonexistent_info: "存在しない情報",
  off_topic: "質問に答えていない",
  other: "その他",
};

type FeedbackDetailModalProps = {
  feedback: MessageFeedback;
  onClose: () => void;
};

const FeedbackDetailModal = ({
  feedback,
  onClose,
}: FeedbackDetailModalProps) => {
  const conversationContext = JSON.parse(
    feedback.conversationContext,
  ) as ConversationContext;
  const toolExecutions = feedback.toolExecutions
    ? (JSON.parse(feedback.toolExecutions) as ToolExecution[])
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 cursor-default"
        onClick={onClose}
        aria-label="閉じる"
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-stone-800">
            フィードバック詳細
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600 rounded-md"
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

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                feedback.rating === "good"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {feedback.rating === "good" ? "良い回答" : "改善が必要"}
            </span>
            {feedback.category && (
              <span className="inline-flex px-2 py-1 text-xs font-medium bg-stone-100 text-stone-600 rounded">
                {CATEGORY_LABELS[feedback.category as FeedbackCategory] ||
                  feedback.category}
              </span>
            )}
            <span className="text-sm text-stone-500">
              {new Date(feedback.createdAt).toLocaleString("ja-JP")}
            </span>
          </div>

          {feedback.comment && (
            <div>
              <h3 className="text-sm font-medium text-stone-700 mb-2">
                コメント
              </h3>
              <div className="bg-stone-50 rounded-lg p-4 text-sm text-stone-700 whitespace-pre-wrap">
                {feedback.comment}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-stone-700 mb-2">
              会話コンテキスト
            </h3>
            <div className="space-y-2">
              {conversationContext.previousMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-50 text-blue-800 ml-8"
                      : "bg-stone-50 text-stone-700 mr-8"
                  }`}
                >
                  <div className="text-xs font-medium mb-1 opacity-70">
                    {msg.role === "user" ? "ユーザー" : "ねっぷちゃん"}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
              <div
                className={`rounded-lg p-3 text-sm border-2 ${
                  conversationContext.targetMessage.role === "user"
                    ? "bg-blue-50 text-blue-800 ml-8 border-blue-300"
                    : "bg-stone-50 text-stone-700 mr-8 border-red-300"
                }`}
              >
                <div className="text-xs font-medium mb-1 opacity-70">
                  {conversationContext.targetMessage.role === "user"
                    ? "ユーザー"
                    : "ねっぷちゃん"}
                  （対象メッセージ）
                </div>
                <div className="whitespace-pre-wrap">
                  {conversationContext.targetMessage.content}
                </div>
              </div>
              {conversationContext.nextMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-50 text-blue-800 ml-8"
                      : "bg-stone-50 text-stone-700 mr-8"
                  }`}
                >
                  <div className="text-xs font-medium mb-1 opacity-70">
                    {msg.role === "user" ? "ユーザー" : "ねっぷちゃん"}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
            </div>
          </div>

          {toolExecutions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-stone-700 mb-2">
                ツール実行結果
              </h3>
              <div className="space-y-2">
                {toolExecutions.map((tool, index) => (
                  <div
                    key={`${tool.toolName}-${index}`}
                    className="bg-stone-50 rounded-lg p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-stone-700">
                        {tool.toolName}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          tool.state === "result"
                            ? "bg-green-100 text-green-700"
                            : tool.state === "call"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {tool.state}
                      </span>
                    </div>
                    {tool.input !== undefined && (
                      <div className="mb-2">
                        <div className="text-xs text-stone-500 mb-1">入力:</div>
                        <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-96">
                          {JSON.stringify(tool.input, null, 2)}
                        </pre>
                      </div>
                    )}
                    {tool.output !== undefined && (
                      <div>
                        <div className="text-xs text-stone-500 mb-1">出力:</div>
                        <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-96">
                          {typeof tool.output === "string"
                            ? tool.output
                            : JSON.stringify(tool.output, null, 2)}
                        </pre>
                      </div>
                    )}
                    {tool.errorText && (
                      <div>
                        <div className="text-xs text-red-500 mb-1">エラー:</div>
                        <pre className="text-xs bg-red-50 text-red-700 p-2 rounded">
                          {tool.errorText}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const FeedbackPanel = () => {
  const [ratingFilter, setRatingFilter] = useState<"good" | "bad" | undefined>(
    undefined,
  );
  const [resolvedFilter, setResolvedFilter] = useState<
    "all" | "unresolved" | "resolved"
  >("all");
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
  const [message, setMessage] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] =
    useState<MessageFeedback | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleDelete = async () => {
    if (
      !window.confirm(
        "全てのフィードバックを削除しますか？この操作は取り消せません。",
      )
    ) {
      return;
    }
    setMessage(null);
    try {
      const result = await deleteMutation.mutateAsync();
      setMessage(result.message);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "フィードバック削除に失敗しました",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-500">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
        エラー: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  const allFeedbacks = data?.pages.flatMap((page) => page.feedbacks) ?? [];
  const feedbacks = allFeedbacks.filter((f) => {
    if (resolvedFilter === "unresolved") return !f.resolvedAt;
    if (resolvedFilter === "resolved") return !!f.resolvedAt;
    return true;
  });
  const stats = data?.pages[0]?.stats;
  const total = data?.pages[0]?.total ?? 0;
  const unresolvedCount = allFeedbacks.filter((f) => !f.resolvedAt).length;
  const resolvedCount = allFeedbacks.filter((f) => !!f.resolvedAt).length;

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="text-2xl font-bold text-stone-800">
              {stats.total}
            </div>
            <div className="text-sm text-stone-500">総フィードバック</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="text-2xl font-bold text-green-600">
              {stats.good}
            </div>
            <div className="text-sm text-stone-500">良い回答</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="text-2xl font-bold text-red-600">{stats.bad}</div>
            <div className="text-sm text-stone-500">改善が必要</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="text-2xl font-bold text-stone-800">
              {stats.total > 0
                ? `${Math.round((stats.good / stats.total) * 100)}%`
                : "-"}
            </div>
            <div className="text-sm text-stone-500">満足率</div>
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
                {CATEGORY_LABELS[category as FeedbackCategory] || category}
                <span className="font-medium">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-sm text-stone-500">
            {feedbacks.length} / {total}件のフィードバック
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                setRatingFilter(undefined);
                setResolvedFilter("all");
              }}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
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
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
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
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                ratingFilter === "bad"
                  ? "bg-red-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              Bad
            </button>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setResolvedFilter("unresolved")}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
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
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                resolvedFilter === "resolved"
                  ? "bg-teal-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              解決済み ({resolvedCount})
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending || allFeedbacks.length === 0}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {deleteMutation.isPending ? "削除中..." : "全て削除"}
        </button>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            deleteMutation.isError
              ? "bg-red-50 text-red-700"
              : "bg-teal-50 text-teal-700"
          }`}
        >
          {message}
        </div>
      )}

      {feedbacks.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-500">
          フィードバックデータがありません
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-auto max-h-[70vh]">
          <table className="min-w-[800px] w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap w-24">
                  評価
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap">
                  カテゴリ
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap">
                  コメント
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap">
                  日時
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap w-24">
                  ステータス
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap w-20">
                  詳細
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {feedbacks.map((feedback) => {
                const isResolved = !!feedback.resolvedAt;
                return (
                  <tr
                    key={feedback.id}
                    className={`hover:bg-stone-50 ${isResolved ? "bg-stone-50 opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3 w-24">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          feedback.rating === "good"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {feedback.rating === "good" ? "Good" : "Bad"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {feedback.category
                        ? CATEGORY_LABELS[
                            feedback.category as FeedbackCategory
                          ] || feedback.category
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-stone-700 max-w-md truncate">
                      {feedback.comment || "-"}
                    </td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                      {new Date(feedback.createdAt).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-4 py-3 w-24">
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
                          resolveMutation.isPending ||
                          unresolveMutation.isPending
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                          isResolved
                            ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        } disabled:opacity-50`}
                      >
                        {isResolved ? (
                          <>
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            解決済み
                          </>
                        ) : (
                          "未解決"
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 w-20">
                      <button
                        type="button"
                        onClick={() => setSelectedFeedback(feedback)}
                        className="text-teal-600 hover:text-teal-700 hover:underline text-sm"
                      >
                        詳細
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

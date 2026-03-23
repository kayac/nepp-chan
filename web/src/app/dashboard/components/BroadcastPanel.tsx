import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

import {
  useBroadcasts,
  useCreateBroadcast,
  useDeleteBroadcast,
  useSendBroadcast,
  useUpdateBroadcast,
} from "~/hooks/useDashboard";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { formatDateTime } from "~/lib/format";
import type { BroadcastMessage, BroadcastStatus } from "~/types";

const STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: "下書き",
  scheduled: "予約済み",
  sent: "送信済み",
  failed: "失敗",
};

const STATUS_STYLES: Record<BroadcastStatus, string> = {
  draft: "bg-stone-100 text-stone-600",
  scheduled: "bg-blue-100 text-blue-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const STATUS_ACTIVE_STYLES: Record<BroadcastStatus, string> = {
  draft: "bg-stone-600 text-white",
  scheduled: "bg-blue-600 text-white",
  sent: "bg-green-600 text-white",
  failed: "bg-red-600 text-white",
};

type ModalMode = "create" | "edit";

type BroadcastFormModalProps = {
  mode: ModalMode;
  broadcast?: BroadcastMessage;
  onClose: () => void;
};

type SendTiming = "now" | "schedule";

const BroadcastFormModal = ({
  mode,
  broadcast,
  onClose,
}: BroadcastFormModalProps) => {
  const [body, setBody] = useState(broadcast?.body ?? "");
  const [timing, setTiming] = useState<SendTiming>(
    broadcast?.scheduledAt ? "schedule" : "now",
  );
  const [scheduledAt, setScheduledAt] = useState(
    broadcast?.scheduledAt?.slice(0, 16) ?? "",
  );

  const createMutation = useCreateBroadcast();
  const updateMutation = useUpdateBroadcast();
  const sendMutation = useSendBroadcast();

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    sendMutation.isPending;

  const isValid =
    body.trim().length > 0 &&
    (timing === "now" || (timing === "schedule" && scheduledAt.length > 0));

  const handleSubmit = async () => {
    if (!isValid) return;

    if (timing === "now") {
      if (
        !window.confirm(
          "この配信メッセージをLINE全フォロワーに即時送信しますか？",
        )
      ) {
        return;
      }
      if (mode === "create") {
        await createMutation.mutateAsync({ body, sendNow: true });
      } else if (broadcast) {
        await updateMutation.mutateAsync({
          id: broadcast.id,
          data: { body },
        });
        await sendMutation.mutateAsync(broadcast.id);
      }
    } else {
      const isoDate = new Date(scheduledAt).toISOString();
      if (mode === "create") {
        await createMutation.mutateAsync({ body, scheduledAt: isoDate });
      } else if (broadcast) {
        await updateMutation.mutateAsync({
          id: broadcast.id,
          data: { body, scheduledAt: isoDate },
        });
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 cursor-default"
        onClick={onClose}
        aria-label="閉じる"
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90dvh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-stone-800">
            {mode === "create" ? "新規配信作成" : "配信を編集"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600 rounded-md"
            aria-label="閉じる"
          >
            <XMarkIcon className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="broadcast-body"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              本文
            </label>
            <textarea
              id="broadcast-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="配信メッセージの本文を入力"
              maxLength={5000}
              rows={8}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
            />
            <div className="text-xs text-stone-400 mt-1 text-right">
              {body.length} / 5000
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-stone-700 mb-2">
              配信タイミング
            </span>
            <div className="flex rounded-lg border border-stone-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setTiming("now")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  timing === "now"
                    ? "bg-teal-600 text-white"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <PaperAirplaneIcon className="w-4 h-4" />
                今すぐ送信
              </button>
              <button
                type="button"
                onClick={() => setTiming("schedule")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-l border-stone-300 flex items-center justify-center gap-1.5 ${
                  timing === "schedule"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <ClockIcon className="w-4 h-4" />
                スケジュール
              </button>
            </div>
          </div>

          {timing === "schedule" && (
            <div>
              <label
                htmlFor="broadcast-scheduled"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                配信日時
              </label>
              <input
                id="broadcast-scheduled"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          )}
        </div>

        {(createMutation.isError ||
          updateMutation.isError ||
          sendMutation.isError) && (
          <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700">
            {createMutation.error?.message ||
              updateMutation.error?.message ||
              sendMutation.error?.message ||
              "エラーが発生しました"}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className={`px-6 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 ${
              timing === "now"
                ? "bg-teal-600 hover:bg-teal-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isPending ? (
              "送信中..."
            ) : timing === "now" ? (
              <>
                <PaperAirplaneIcon className="w-4 h-4" />
                送信する
              </>
            ) : (
              <>
                <ClockIcon className="w-4 h-4" />
                予約する
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const BroadcastPanel = () => {
  const [statusFilter, setStatusFilter] = useState<BroadcastStatus | undefined>(
    undefined,
  );
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useBroadcasts(30, { status: statusFilter });
  const deleteMutation = useDeleteBroadcast();
  const sendMutation = useSendBroadcast();
  const [modalState, setModalState] = useState<{
    open: boolean;
    mode: ModalMode;
    broadcast?: BroadcastMessage;
  }>({ open: false, mode: "create" });

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    isFetching: isFetchingNextPage,
    onFetch: fetchNextPage,
  });

  const handleDelete = (broadcast: BroadcastMessage) => {
    if (!window.confirm(`「${broadcast.body.slice(0, 30)}」を削除しますか？`)) {
      return;
    }
    deleteMutation.mutate(broadcast.id);
  };

  const handleSendNow = (broadcast: BroadcastMessage) => {
    if (
      !window.confirm(
        `「${broadcast.body.slice(0, 30)}」をLINE全フォロワーに即時送信しますか？`,
      )
    ) {
      return;
    }
    sendMutation.mutate(broadcast.id);
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

  const broadcasts = data?.pages.flatMap((page) => page.broadcasts) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-stone-500">
            {broadcasts.length} / {total}件の配信メッセージ
          </div>
          <button
            type="button"
            onClick={() => setModalState({ open: true, mode: "create" })}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-1.5"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
            新規作成
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter(undefined)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
              statusFilter === undefined
                ? "bg-stone-800 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            すべて
          </button>
          {(["draft", "scheduled", "sent", "failed"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
                statusFilter === status
                  ? STATUS_ACTIVE_STYLES[status]
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {(deleteMutation.isError || sendMutation.isError) && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700">
          {deleteMutation.error?.message ||
            sendMutation.error?.message ||
            "操作に失敗しました"}
        </div>
      )}

      {broadcasts.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-500">
          配信メッセージがありません
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((broadcast) => (
            <div
              key={broadcast.id}
              className="bg-white rounded-xl border border-stone-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${STATUS_STYLES[broadcast.status as BroadcastStatus]}`}
                    >
                      {broadcast.status === "sent" && (
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                      )}
                      {broadcast.status === "scheduled" && (
                        <ClockIcon className="w-3.5 h-3.5" />
                      )}
                      {broadcast.status === "failed" && (
                        <ExclamationCircleIcon className="w-3.5 h-3.5" />
                      )}
                      {STATUS_LABELS[broadcast.status as BroadcastStatus]}
                    </span>
                    <span className="text-xs text-stone-400 whitespace-nowrap">
                      {broadcast.sentAt
                        ? `送信: ${formatDateTime(broadcast.sentAt)}`
                        : broadcast.scheduledAt
                          ? `予約: ${formatDateTime(broadcast.scheduledAt)}`
                          : `作成: ${formatDateTime(broadcast.createdAt)}`}
                    </span>
                  </div>
                  <p className="text-sm text-stone-700 line-clamp-3 whitespace-pre-wrap">
                    {broadcast.body}
                  </p>
                  {broadcast.errorMessage && (
                    <p className="text-xs text-red-600 mt-1">
                      エラー: {broadcast.errorMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {broadcast.status !== "sent" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setModalState({
                            open: true,
                            mode: "edit",
                            broadcast,
                          })
                        }
                        className="p-1.5 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-100 transition-colors"
                        title="編集"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendNow(broadcast)}
                        disabled={sendMutation.isPending}
                        className="p-1.5 text-teal-500 hover:text-teal-700 rounded-md hover:bg-teal-50 transition-colors disabled:opacity-50"
                        title="即時送信"
                      >
                        <PaperAirplaneIcon className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {(broadcast.status === "draft" ||
                    broadcast.status === "failed") && (
                    <button
                      type="button"
                      onClick={() => handleDelete(broadcast)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="削除"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div ref={loadMoreRef} className="py-4 text-center">
            {isFetchingNextPage && (
              <div className="text-stone-500 text-sm">読み込み中...</div>
            )}
            {!hasNextPage && broadcasts.length > 0 && (
              <div className="text-stone-400 text-sm">
                すべての配信メッセージを表示しました
              </div>
            )}
          </div>
        </div>
      )}

      {modalState.open && (
        <BroadcastFormModal
          mode={modalState.mode}
          broadcast={modalState.broadcast}
          onClose={() => setModalState({ open: false, mode: "create" })}
        />
      )}
    </div>
  );
};

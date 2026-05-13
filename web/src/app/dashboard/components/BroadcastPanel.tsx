import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

import {
  useBroadcasts,
  useDeleteBroadcast,
  useSendBroadcast,
} from "~/app/dashboard/hooks/useBroadcasts";
import { useInfiniteScroll } from "~/app/dashboard/hooks/useInfiniteScroll";
import { confirmDialog } from "~/lib/dialog";
import { formatDateTime } from "~/lib/format";
import type { BroadcastMessage, BroadcastStatus } from "~/types";
import { BroadcastFormModal } from "./broadcast/BroadcastFormModal";
import { BroadcastPartPreview } from "./broadcast/BroadcastPartPreview";
import type { ModalMode } from "./broadcast/useBroadcastForm";

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
    if (!confirmDialog(`「${broadcast.body.slice(0, 30)}」を削除しますか？`)) {
      return;
    }
    deleteMutation.mutate(broadcast.id);
  };

  const handleSendNow = (broadcast: BroadcastMessage) => {
    if (
      !confirmDialog(
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
                  <BroadcastPartPreview parts={broadcast.parts} />
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

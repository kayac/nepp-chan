import {
  ChartBarIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@nepp-chan/shared/ui/Button";
import { useCallback, useState } from "react";
import { PollForm } from "~/app/dashboard/components/poll/PollForm";
import { ResultsModal } from "~/app/dashboard/components/poll/ResultsModal";
import { useInfiniteScroll } from "~/app/dashboard/hooks/useInfiniteScroll";
import {
  useClosePoll,
  useDeletePoll,
  usePolls,
  useSendPoll,
} from "~/app/dashboard/hooks/usePolls";
import { confirmDialog } from "~/lib/dialog";
import { formatDateTime } from "~/lib/format";
import type { Poll, PollStatus } from "~/types";

const STATUS_LABELS: Record<PollStatus, string> = {
  draft: "下書き",
  scheduled: "予約済み",
  sent: "配信中",
  closed: "締切",
};

const STATUS_STYLES: Record<PollStatus, string> = {
  draft: "bg-stone-100 text-stone-600",
  scheduled: "bg-blue-100 text-blue-700",
  sent: "bg-green-100 text-green-700",
  closed: "bg-stone-200 text-stone-500",
};

type ModalState =
  | { type: "create" }
  | { type: "edit"; poll: Poll }
  | { type: "results"; id: string }
  | null;

export const PollPanel = () => {
  const [statusFilter, setStatusFilter] = useState<PollStatus | undefined>();
  const [modal, setModal] = useState<ModalState>(null);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    usePolls(30, {
      status: statusFilter,
    });

  const deleteMutation = useDeletePoll();
  const sendMutation = useSendPoll();
  const closeMutation = useClosePoll();

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    isFetching: isFetchingNextPage,
    onFetch: fetchNextPage,
  });

  const polls = data?.pages.flatMap((p) => p.polls) ?? [];

  const handleSend = useCallback(
    async (id: string) => {
      if (!confirmDialog("LINEに配信しますか？")) return;
      await sendMutation.mutateAsync(id);
    },
    [sendMutation],
  );

  const handleClose = useCallback(
    async (id: string) => {
      if (!confirmDialog("回答受付を締め切りますか？")) return;
      await closeMutation.mutateAsync(id);
    },
    [closeMutation],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirmDialog("削除しますか？")) return;
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {(
            [undefined, "draft", "scheduled", "sent", "closed"] as (
              | PollStatus
              | undefined
            )[]
          ).map((status) => (
            <button
              key={status ?? "all"}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                statusFilter === status
                  ? "bg-teal-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {status ? STATUS_LABELS[status] : "すべて"}
            </button>
          ))}
        </div>
        <Button type="button" onClick={() => setModal({ type: "create" })}>
          <PlusIcon className="w-4 h-4" />
          新規作成
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-stone-500 text-center py-8">読み込み中...</p>
      )}

      {!isLoading && polls.length === 0 && (
        <p className="text-sm text-stone-500 text-center py-8">
          投票はまだありません
        </p>
      )}

      <div className="space-y-3">
        {polls.map((q) => (
          <div
            key={q.id}
            className="bg-white border border-stone-200 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-stone-800 truncate">
                    {q.title}
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_STYLES[q.status]}`}
                  >
                    {STATUS_LABELS[q.status]}
                  </span>
                </div>
                <p className="text-sm text-stone-500 mt-1 line-clamp-1">
                  選択肢: {q.choices.join(" / ")}
                </p>
                {q.followUpPrompt && (
                  <p className="text-xs text-stone-400 mt-1 line-clamp-1">
                    ヒント: {q.followUpPrompt}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
                  <span>{formatDateTime(q.createdAt)}</span>
                  {q.scheduledAt && (
                    <span className="text-blue-600">
                      予約: {formatDateTime(q.scheduledAt)}
                    </span>
                  )}
                  {q.sentAt && <span>配信: {formatDateTime(q.sentAt)}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {(q.status === "sent" || q.status === "closed") && (
                  <button
                    type="button"
                    onClick={() => setModal({ type: "results", id: q.id })}
                    className="p-2 hover:bg-stone-100 rounded-lg text-teal-700"
                    title="結果を見る"
                  >
                    <ChartBarIcon className="w-4 h-4" />
                  </button>
                )}
                {q.status === "draft" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setModal({ type: "edit", poll: q })}
                      className="p-2 hover:bg-stone-100 rounded-lg text-stone-600"
                      title="編集"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSend(q.id)}
                      disabled={sendMutation.isPending}
                      className="p-2 hover:bg-teal-50 rounded-lg text-teal-700 disabled:opacity-50"
                      title="配信"
                    >
                      <PaperAirplaneIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 hover:bg-red-50 rounded-lg text-stone-400 hover:text-red-500 disabled:opacity-50"
                      title="削除"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </>
                )}
                {q.status === "scheduled" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSend(q.id)}
                      disabled={sendMutation.isPending}
                      className="p-2 hover:bg-teal-50 rounded-lg text-teal-700 disabled:opacity-50"
                      title="今すぐ配信"
                    >
                      <PaperAirplaneIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 hover:bg-red-50 rounded-lg text-stone-400 hover:text-red-500 disabled:opacity-50"
                      title="削除"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </>
                )}
                {q.status === "sent" && (
                  <button
                    type="button"
                    onClick={() => handleClose(q.id)}
                    disabled={closeMutation.isPending}
                    className="p-2 hover:bg-stone-100 rounded-lg text-stone-600 disabled:opacity-50"
                    title="締切"
                  >
                    <LockClosedIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div ref={loadMoreRef} />
      {isFetchingNextPage && (
        <p className="text-xs text-stone-400 text-center py-2">読み込み中...</p>
      )}

      {modal?.type === "create" && <PollForm onClose={() => setModal(null)} />}
      {modal?.type === "edit" && (
        <PollForm poll={modal.poll} onClose={() => setModal(null)} />
      )}
      {modal?.type === "results" && (
        <ResultsModal pollId={modal.id} onClose={() => setModal(null)} />
      )}
    </div>
  );
};

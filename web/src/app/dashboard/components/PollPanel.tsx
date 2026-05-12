import {
  ChartBarIcon,
  InformationCircleIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";

import {
  useClosePoll,
  useCreatePoll,
  useDeletePoll,
  usePollResults,
  usePolls,
  useSendPoll,
  useUpdatePoll,
} from "~/hooks/dashboard/usePolls";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { formatDateTime } from "~/lib/format";
import type { CreatePollRequest, Poll, PollStatus } from "~/types";
import {
  type ChoiceFormState,
  collectValidChoices,
  isPollFormValid,
} from "./poll-helpers";

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

const emptyChoice = (): ChoiceFormState => ({
  id: crypto.randomUUID(),
  value: "",
});

// --- 投票作成／編集フォーム（TypeSelector2 レイアウト） ---

const PollForm = ({ poll, onClose }: { poll?: Poll; onClose: () => void }) => {
  const [title, setTitle] = useState(poll?.title ?? "");
  const [choices, setChoices] = useState<ChoiceFormState[]>(() => {
    if (poll?.choices?.length) {
      return poll.choices.map((c) => ({ id: crypto.randomUUID(), value: c }));
    }
    return [emptyChoice(), emptyChoice()];
  });
  const [followUpPrompt, setFollowUpPrompt] = useState(
    poll?.followUpPrompt ?? "",
  );

  const createMutation = useCreatePoll();
  const updateMutation = useUpdatePoll();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isEditMode = !!poll;

  const addChoice = () => setChoices([...choices, emptyChoice()]);
  const removeChoice = (id: string) =>
    setChoices(choices.filter((c) => c.id !== id));
  const updateChoice = (id: string, value: string) =>
    setChoices(choices.map((c) => (c.id === id ? { ...c, value } : c)));

  const validChoices = collectValidChoices(choices);
  const isValid = isPollFormValid(title, validChoices);

  const handleSubmit = async (sendNow: boolean) => {
    if (sendNow && !isEditMode) {
      if (!confirm("この投票をLINE全フォロワーに即時配信しますか？")) return;
    }
    const payload: CreatePollRequest = {
      title: title.trim(),
      choices: validChoices,
      followUpPrompt: followUpPrompt.trim() || undefined,
      ...(!isEditMode && sendNow && { sendNow: true }),
    };
    if (isEditMode) {
      await updateMutation.mutateAsync({ id: poll.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-[2px] z-50 flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-stone-50 rounded-xl shadow-xl w-full max-w-xl mx-4 mb-8 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-start justify-between px-8 pt-8 pb-4">
          <div>
            <h3 className="text-2xl font-semibold text-stone-800">
              {isEditMode ? "投票を編集" : "新規作成"}
            </h3>
            <p className="text-sm text-stone-500 mt-1">何を聞きますか？</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 rounded-lg -mr-2"
          >
            <XMarkIcon className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* 本体カード */}
        <div className="px-8 pb-4">
          <div className="bg-white border border-stone-200 rounded-lg p-5 space-y-6">
            {/* お題 */}
            <div className="space-y-1.5">
              <label
                htmlFor="poll-title"
                className="block text-sm font-medium text-stone-600"
              >
                お題
              </label>
              <input
                id="poll-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="みんなに聞きたいことを入力"
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* 選択肢 */}
            <div className="space-y-2">
              <span className="block text-sm font-medium text-stone-600">
                あなたならどれ？
              </span>
              {choices.map((choice, i) => (
                <div key={choice.id} className="flex items-center gap-2">
                  <span className="text-sm text-stone-400 w-5 shrink-0">
                    {i + 1}.
                  </span>
                  <input
                    type="text"
                    value={choice.value}
                    onChange={(e) => updateChoice(choice.id, e.target.value)}
                    placeholder="選択肢を入力"
                    className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {choices.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeChoice(choice.id)}
                      className="p-1 hover:bg-red-50 rounded text-stone-400 hover:text-red-500"
                      aria-label="選択肢を削除"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addChoice}
                className="flex items-center gap-1 text-sm text-teal-700 hover:text-teal-800 pt-1"
              >
                <PlusIcon className="w-4 h-4" />
                選択肢を追加
              </button>
            </div>

            {/* ねっぷちゃんに聞いてほしいこと（任意） */}
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <label
                  htmlFor="poll-followup"
                  className="block text-sm font-medium text-stone-600"
                >
                  ねっぷちゃんに聞いてほしいこと
                </label>
                <span className="text-xs text-stone-400">（任意）</span>
              </div>
              <p className="text-xs text-stone-500">
                回答後にねっぷちゃんが会話を広げるヒントになります
              </p>
              <textarea
                id="poll-followup"
                value={followUpPrompt}
                onChange={(e) => setFollowUpPrompt(e.target.value)}
                placeholder="例：なぜその選択肢を選んだか聞いてみて"
                rows={3}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="px-8 py-4 border-t border-stone-200 bg-white">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={!isValid || isSubmitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下書き保存
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={!isValid || isSubmitting}
              className="flex-1 px-5 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
              {isSubmitting ? "処理中..." : isEditMode ? "保存" : "投票を開始"}
            </button>
          </div>
        </div>

        {/* 注記 */}
        <div className="px-8 pb-6 pt-2">
          <div className="flex items-start gap-2 p-3 bg-stone-100/70 rounded-lg">
            <InformationCircleIcon className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
            <p className="text-xs text-stone-500 leading-relaxed">
              投票の結果はみんなに共有されます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 結果モーダル ---

const ResultsModal = ({
  pollId,
  onClose,
}: {
  pollId: string;
  onClose: () => void;
}) => {
  const { data: results, isLoading } = usePollResults(pollId);

  return (
    <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-[2px] z-50 flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 mb-8">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="text-lg font-semibold text-stone-800">投票結果</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 rounded-lg"
          >
            <XMarkIcon className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {isLoading && (
            <p className="text-sm text-stone-500 text-center py-8">
              読み込み中...
            </p>
          )}

          {results && (
            <>
              <div>
                <h4 className="text-base font-medium text-stone-800">
                  {results.title}
                </h4>
                <p className="text-sm text-stone-500 mt-1">
                  {results.totalSubmissions}人が参加
                </p>
              </div>
              <div className="space-y-3">
                {results.choiceResults.map((cr) => (
                  <div key={cr.choice} className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-stone-600">
                      <span>{cr.choice}</span>
                      <span className="tabular-nums">
                        {cr.count}票（{cr.percentage}%）
                      </span>
                    </div>
                    <div className="h-5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all"
                        style={{ width: `${cr.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- メインパネル ---

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
      if (!confirm("LINEに配信しますか？")) return;
      await sendMutation.mutateAsync(id);
    },
    [sendMutation],
  );

  const handleClose = useCallback(
    async (id: string) => {
      if (!confirm("回答受付を締め切りますか？")) return;
      await closeMutation.mutateAsync(id);
    },
    [closeMutation],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("削除しますか？")) return;
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
        <button
          type="button"
          onClick={() => setModal({ type: "create" })}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
        >
          <PlusIcon className="w-4 h-4" />
          新規作成
        </button>
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

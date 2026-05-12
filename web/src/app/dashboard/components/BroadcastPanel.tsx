import {
  ArrowDownIcon,
  ArrowUpIcon,
  Bars3BottomLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useRef, useState } from "react";

import {
  useBroadcasts,
  useCreateBroadcast,
  useDeleteBroadcast,
  useSendBroadcast,
  useUpdateBroadcast,
  useUploadBroadcastImage,
} from "~/hooks/dashboard/useBroadcasts";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { confirmDialog } from "~/lib/dialog";
import { formatDateTime } from "~/lib/format";
import type { BroadcastMessage, BroadcastPart, BroadcastStatus } from "~/types";
import { getImageUrl, type PartState, parseParts } from "./broadcast-helpers";

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

const MAX_PARTS = 5;

let partIdCounter = 0;
const nextPartId = () => `part-${++partIdCounter}`;

type ModalMode = "create" | "edit";

type BroadcastFormModalProps = {
  mode: ModalMode;
  broadcast?: BroadcastMessage;
  onClose: () => void;
};

type SendTiming = "now" | "schedule";

const PartEditor = ({
  part,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  part: PartState;
  index: number;
  total: number;
  onChange: (index: number, part: PartState) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContent =
    part.type === "text"
      ? part.text.trim().length > 0
      : !!(part.imageR2Key || part.file);
  const canSwitchToText = part.type === "text" || !hasContent;
  const canSwitchToImage = part.type === "image" || !hasContent;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    onChange(index, {
      id: part.id,
      type: "image",
      imageR2Key: "",
      file,
      previewUrl,
    });
  };

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between bg-stone-50 px-2 py-1.5">
        <div className="flex">
          <button
            type="button"
            disabled={!canSwitchToText}
            onClick={() =>
              part.type !== "text" &&
              onChange(index, { id: part.id, type: "text", text: "" })
            }
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-l border transition-colors ${
              part.type === "text"
                ? "bg-white text-stone-800 border-stone-300"
                : canSwitchToText
                  ? "bg-stone-100 text-stone-400 border-stone-200 hover:text-stone-600"
                  : "bg-stone-100 text-stone-300 border-stone-200 cursor-not-allowed"
            }`}
          >
            <Bars3BottomLeftIcon className="w-3.5 h-3.5" />
            テキスト
          </button>
          <button
            type="button"
            disabled={!canSwitchToImage}
            onClick={() =>
              part.type !== "image" &&
              onChange(index, {
                id: part.id,
                type: "image",
                imageR2Key: "",
              })
            }
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-r border border-l-0 transition-colors ${
              part.type === "image"
                ? "bg-white text-stone-800 border-stone-300"
                : canSwitchToImage
                  ? "bg-stone-100 text-stone-400 border-stone-200 hover:text-stone-600"
                  : "bg-stone-100 text-stone-300 border-stone-200 cursor-not-allowed"
            }`}
          >
            <PhotoIcon className="w-3.5 h-3.5" />
            画像
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(index, "up")}
            disabled={index === 0}
            className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30"
          >
            <ArrowUpIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, "down")}
            disabled={index === total - 1}
            className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30"
          >
            <ArrowDownIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={total <= 1}
            className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3">
        {part.type === "text" ? (
          <div>
            <textarea
              value={part.text}
              onChange={(e) =>
                onChange(index, {
                  id: part.id,
                  type: "text",
                  text: e.target.value,
                })
              }
              placeholder="テキストを入力"
              maxLength={5000}
              rows={4}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
            />
            <div className="text-xs text-stone-400 mt-1 text-right">
              {part.text.length} / 5000
            </div>
          </div>
        ) : (
          <div>
            {part.previewUrl || part.imageR2Key ? (
              <div className="relative">
                <img
                  src={part.previewUrl || getImageUrl(part.imageR2Key)}
                  alt="プレビュー"
                  className="max-h-48 rounded-lg object-contain mx-auto"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange(index, {
                      id: part.id,
                      type: "image",
                      imageR2Key: "",
                    })
                  }
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-stone-300 rounded-lg text-stone-400 hover:border-teal-400 hover:text-teal-500 transition-colors flex flex-col items-center gap-2"
              >
                <PhotoIcon className="w-8 h-8" />
                <span className="text-sm font-medium">写真をアップロード</span>
                <span className="text-xs">JPG, PNG / 10MB以下</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  );
};

const BroadcastFormModal = ({
  mode,
  broadcast,
  onClose,
}: BroadcastFormModalProps) => {
  const [parts, setParts] = useState<PartState[]>(
    broadcast
      ? parseParts(broadcast, nextPartId)
      : [{ id: nextPartId(), type: "text", text: "" }],
  );
  const [timing, setTiming] = useState<SendTiming>(
    broadcast?.scheduledAt ? "schedule" : "now",
  );
  const [scheduledAt, setScheduledAt] = useState(
    broadcast?.scheduledAt?.slice(0, 16) ?? "",
  );

  const createMutation = useCreateBroadcast();
  const updateMutation = useUpdateBroadcast();
  const sendMutation = useSendBroadcast();
  const uploadMutation = useUploadBroadcastImage();

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    sendMutation.isPending ||
    uploadMutation.isPending;

  const isValid =
    parts.length > 0 &&
    parts.every((p) => {
      if (p.type === "text") return p.text.trim().length > 0;
      if (p.type === "image") return p.imageR2Key || p.file;
      return false;
    }) &&
    (timing === "now" || (timing === "schedule" && scheduledAt.length > 0));

  const handlePartChange = useCallback((index: number, part: PartState) => {
    setParts((prev) => prev.map((p, i) => (i === index ? part : p)));
  }, []);

  const handlePartRemove = useCallback((index: number) => {
    setParts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePartMove = useCallback(
    (index: number, direction: "up" | "down") => {
      setParts((prev) => {
        const next = [...prev];
        const target = direction === "up" ? index - 1 : index + 1;
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    },
    [],
  );

  const handleAddPart = () => {
    if (parts.length >= MAX_PARTS) return;
    setParts((prev) => [...prev, { id: nextPartId(), type: "text", text: "" }]);
  };

  const handleSubmit = async () => {
    if (!isValid) return;

    if (timing === "now") {
      if (
        !confirmDialog(
          "この配信メッセージをLINE全フォロワーに即時送信しますか？",
        )
      ) {
        return;
      }
    }

    const uploadedParts: BroadcastPart[] = await Promise.all(
      parts.map(async (part) => {
        if (part.type === "text") {
          return { type: "text" as const, text: part.text };
        }
        if (part.file) {
          const { imageR2Key, imageDescription } =
            await uploadMutation.mutateAsync(part.file);
          return { type: "image" as const, imageR2Key, imageDescription };
        }
        return {
          type: "image" as const,
          imageR2Key: part.imageR2Key,
          imageDescription: part.imageDescription,
        };
      }),
    );

    if (timing === "now") {
      if (mode === "create") {
        await createMutation.mutateAsync({
          parts: uploadedParts,
          sendNow: true,
        });
      } else if (broadcast) {
        await updateMutation.mutateAsync({
          id: broadcast.id,
          data: { parts: uploadedParts },
        });
        await sendMutation.mutateAsync(broadcast.id);
      }
    } else {
      const isoDate = new Date(scheduledAt).toISOString();
      if (mode === "create") {
        await createMutation.mutateAsync({
          parts: uploadedParts,
          scheduledAt: isoDate,
        });
      } else if (broadcast) {
        await updateMutation.mutateAsync({
          id: broadcast.id,
          data: { parts: uploadedParts, scheduledAt: isoDate },
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

        <div className="space-y-3">
          {parts.map((part, index) => (
            <PartEditor
              key={part.id}
              part={part}
              index={index}
              total={parts.length}
              onChange={handlePartChange}
              onRemove={handlePartRemove}
              onMove={handlePartMove}
            />
          ))}

          {parts.length < MAX_PARTS && (
            <button
              type="button"
              onClick={handleAddPart}
              className="w-full py-2 border border-dashed border-teal-300 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors text-sm font-medium flex items-center justify-center gap-1"
            >
              <PlusIcon className="w-4 h-4" />
              追加
            </button>
          )}
        </div>

        <div className="mt-4 space-y-4">
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
          sendMutation.isError ||
          uploadMutation.isError) && (
          <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700">
            {createMutation.error?.message ||
              updateMutation.error?.message ||
              sendMutation.error?.message ||
              uploadMutation.error?.message ||
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

const BroadcastPartPreview = ({
  parts,
}: {
  parts: string | null;
  body: string;
}) => {
  if (!parts) return null;

  let parsed: BroadcastPart[];
  try {
    parsed = JSON.parse(parts);
  } catch {
    return null;
  }

  const hasImage = parsed.some((p) => p.type === "image");
  if (!hasImage) return null;

  return (
    <div className="flex gap-1.5 mb-1.5">
      {parsed
        .filter(
          (p): p is Extract<BroadcastPart, { type: "image" }> =>
            p.type === "image",
        )
        .map((p) => (
          <img
            key={p.imageR2Key}
            src={getImageUrl(p.imageR2Key)}
            alt=""
            className="w-12 h-12 rounded object-cover border border-stone-200"
          />
        ))}
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
                  <BroadcastPartPreview
                    parts={broadcast.parts}
                    body={broadcast.body}
                  />
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

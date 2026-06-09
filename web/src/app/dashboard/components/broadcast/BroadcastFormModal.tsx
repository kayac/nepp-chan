import {
  ClockIcon,
  PaperAirplaneIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import {
  MAX_PARTS,
  type ModalMode,
  useBroadcastForm,
} from "~/app/dashboard/hooks/useBroadcastForm";
import { Dialog } from "~/components/ui/Dialog";
import type { BroadcastMessage } from "~/types";
import { PartEditor } from "./PartEditor";

type Props = {
  mode: ModalMode;
  broadcast?: BroadcastMessage;
  onClose: () => void;
};

export const BroadcastFormModal = ({ mode, broadcast, onClose }: Props) => {
  const {
    parts,
    timing,
    setTiming,
    scheduledAt,
    setScheduledAt,
    isPending,
    isValid,
    isError,
    errorMessage,
    handlePartChange,
    handlePartRemove,
    handlePartMove,
    handleAddPart,
    handleSubmit,
  } = useBroadcastForm({ mode, broadcast, onClose });

  return (
    <Dialog onClose={onClose} className="w-full max-w-2xl">
      <div className="bg-white rounded-xl shadow-xl mx-4 p-6 max-h-[90dvh] overflow-auto">
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

        {isError && (
          <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700">
            {errorMessage || "エラーが発生しました"}
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
    </Dialog>
  );
};

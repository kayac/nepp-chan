import {
  InformationCircleIcon,
  PaperAirplaneIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@nepp-chan/shared/ui/Button";

import { usePollForm } from "~/app/dashboard/hooks/usePollForm";
import { Dialog } from "~/components/ui/Dialog";
import { ModalHeader } from "~/components/ui/ModalHeader";
import type { Poll } from "~/types";

type Props = {
  poll?: Poll;
  onClose: () => void;
};

export const PollForm = ({ poll, onClose }: Props) => {
  const {
    title,
    setTitle,
    choices,
    addChoice,
    removeChoice,
    updateChoice,
    followUpPrompt,
    setFollowUpPrompt,
    isValid,
    isSubmitting,
    isEditMode,
    handleSubmit,
  } = usePollForm({ poll, onClose });

  return (
    <Dialog
      onClose={onClose}
      className="w-full max-w-xl backdrop:bg-stone-900/30 backdrop:backdrop-blur-[2px]"
    >
      <div className="bg-stone-50 rounded-xl shadow-xl mx-4 max-h-[90dvh] overflow-y-auto">
        <ModalHeader
          className="px-8 pt-8 pb-4"
          titleClassName="text-2xl font-semibold"
          onClose={onClose}
          title={isEditMode ? "投票を編集" : "新規作成"}
          description="何を聞きますか？"
        />

        <div className="px-8 pb-4">
          <div className="bg-white border border-stone-200 rounded-lg p-5 space-y-6">
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

        <div className="px-8 py-4 border-t border-stone-200 bg-white">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={!isValid || isSubmitting}
              className="flex-1 py-2.5"
            >
              下書き保存
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={!isValid || isSubmitting}
              className="flex-1 py-2.5"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
              {isSubmitting ? "処理中..." : isEditMode ? "保存" : "投票を開始"}
            </Button>
          </div>
        </div>

        <div className="px-8 pb-6 pt-2">
          <div className="flex items-start gap-2 p-3 bg-stone-100/70 rounded-lg">
            <InformationCircleIcon className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
            <p className="text-xs text-stone-500 leading-relaxed">
              投票の結果はみんなに共有されます。
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

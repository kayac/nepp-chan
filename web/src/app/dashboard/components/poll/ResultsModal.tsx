import { XMarkIcon } from "@heroicons/react/24/outline";
import { LoadingText } from "@nepp-chan/shared/ui/Loading";

import { usePollResults } from "~/app/dashboard/hooks/usePolls";
import { Dialog } from "~/components/ui/Dialog";

type Props = {
  pollId: string;
  onClose: () => void;
};

export const ResultsModal = ({ pollId, onClose }: Props) => {
  const { data: results, isLoading } = usePollResults(pollId);

  return (
    <Dialog
      onClose={onClose}
      className="w-full max-w-lg backdrop:bg-stone-900/30 backdrop:backdrop-blur-[2px]"
    >
      <div className="bg-white rounded-xl shadow-xl mx-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="text-lg font-semibold text-stone-800">投票結果</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 rounded-lg"
            aria-label="閉じる"
          >
            <XMarkIcon className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {isLoading && (
            <div className="flex justify-center py-8">
              <LoadingText>読み込み中...</LoadingText>
            </div>
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
    </Dialog>
  );
};

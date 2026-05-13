import { XMarkIcon } from "@heroicons/react/24/outline";

import { usePollResults } from "~/hooks/dashboard/usePolls";

type Props = {
  pollId: string;
  onClose: () => void;
};

export const ResultsModal = ({ pollId, onClose }: Props) => {
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
            aria-label="閉じる"
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

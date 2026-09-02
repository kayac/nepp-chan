import { useState } from "react";
import { CorrectionForm } from "~/app/dashboard/components/review/CorrectionForm";
import {
  useReviewDetail,
  useSubmitReviewDecision,
} from "~/app/dashboard/hooks/useReview";
import { Dialog } from "~/components/ui/Dialog";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import { ModalHeader } from "~/components/ui/ModalHeader";
import { formatDateTime } from "~/lib/format";
import type { ReviewDecisionType } from "~/types";
import { ArchivedEvidence } from "./ArchivedEvidence";
import { flagLabels, REVIEW_DECISION_LABELS } from "./helpers";

type Props = {
  answerRunId: string;
  onClose: () => void;
};

const DECISION_OPTIONS: Array<{
  value: ReviewDecisionType;
  className: string;
}> = [
  { value: "no_issue", className: "bg-teal-600 hover:bg-teal-700" },
  { value: "incorrect", className: "bg-red-600 hover:bg-red-700" },
  { value: "source_missing", className: "bg-amber-600 hover:bg-amber-700" },
];

export const ReviewDetailModal = ({ answerRunId, onClose }: Props) => {
  const { data, isLoading, error } = useReviewDetail(answerRunId);
  const decisionMutation = useSubmitReviewDecision();
  const [comment, setComment] = useState("");
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);

  const correctionSourceOptions = [
    ...new Set(
      (data?.runs ?? [])
        .flatMap((run) => run.hits.map((hit) => hit.source))
        .filter((source) => !source.startsWith("curated/corrections/")),
    ),
  ];

  const handleDecide = (decision: ReviewDecisionType) => {
    decisionMutation.mutate(
      {
        answerRunId,
        decision,
        comment: comment.trim() || undefined,
      },
      { onSuccess: () => setComment("") },
    );
  };

  return (
    <Dialog onClose={onClose} className="w-full max-w-3xl">
      <div className="bg-white rounded-xl shadow-xl mx-4 p-6 max-h-[90dvh] overflow-auto">
        <ModalHeader
          className="mb-4"
          titleClassName="text-lg"
          onClose={onClose}
          title="回答レビュー"
        />

        {isLoading && (
          <div className="py-8 text-center text-stone-500 text-sm">
            読み込み中...
          </div>
        )}
        {error && <ErrorBanner>{formatError(error)}</ErrorBanner>}

        {data && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              {flagLabels(data.flags).map((label) => (
                <span
                  key={label}
                  className="inline-flex px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded"
                >
                  {label}
                </span>
              ))}
              <span className="text-sm text-stone-500">
                {formatDateTime(data.createdAt)}
              </span>
            </div>

            {data.conversation ? (
              <div className="space-y-2">
                {data.conversation.question && (
                  <div className="rounded-lg p-3 text-sm bg-blue-50 text-blue-800 ml-8">
                    <div className="text-xs font-medium mb-1 opacity-70">
                      ユーザー
                    </div>
                    <div className="whitespace-pre-wrap">
                      {data.conversation.question}
                    </div>
                  </div>
                )}
                <div className="rounded-lg p-3 text-sm bg-stone-50 text-stone-700 mr-8">
                  <div className="text-xs font-medium mb-1 opacity-70">
                    ねっぷちゃん
                  </div>
                  <div className="whitespace-pre-wrap">
                    {data.conversation.answer}
                  </div>
                </div>
              </div>
            ) : data.archivedEvidence ? (
              <ArchivedEvidence evidence={data.archivedEvidence} />
            ) : (
              <div className="text-sm text-stone-400">
                会話は保管期限切れなどで表示できません
              </div>
            )}

            {data.runs.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-stone-700 mb-2">
                  ナレッジ検索の根拠
                </h3>
                <div className="space-y-2">
                  {data.runs.map((run) => (
                    <div
                      key={`${run.createdAt}-${run.query}`}
                      className="bg-stone-50 rounded-lg p-3 text-sm"
                    >
                      <div className="font-medium text-stone-700 mb-1">
                        検索: {run.query}
                      </div>
                      {run.hits.length === 0 ? (
                        <div className="text-xs text-red-600">ヒットなし</div>
                      ) : (
                        <ul className="space-y-1">
                          {run.hits.map((hit) => (
                            <li
                              key={`${hit.source}#${hit.section ?? ""}`}
                              className="text-xs text-stone-600 flex items-baseline gap-2"
                            >
                              <span className="font-mono">{hit.source}</span>
                              {hit.section && <span>#{hit.section}</span>}
                              <span className="text-stone-400">
                                score {hit.score.toFixed(2)}
                                {hit.rerankScore !== undefined &&
                                  ` / rerank ${hit.rerankScore.toFixed(2)}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.feedbacks.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-stone-700 mb-2">
                  ユーザー評価
                </h3>
                <div className="space-y-2">
                  {data.feedbacks.map((feedback) => (
                    <div
                      key={feedback.id}
                      className="bg-stone-50 rounded-lg p-3 text-sm text-stone-700"
                    >
                      <div className="text-xs text-stone-500 mb-1">
                        {feedback.rating} ・{" "}
                        {formatDateTime(feedback.createdAt)}
                      </div>
                      {feedback.comment ?? "コメントなし"}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.decisions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-stone-700 mb-2">
                  判断履歴
                </h3>
                <ul className="space-y-1">
                  {data.decisions.map((decision) => (
                    <li key={decision.id} className="text-sm text-stone-600">
                      {REVIEW_DECISION_LABELS[decision.decision] ??
                        decision.decision}
                      {decision.comment && ` — ${decision.comment}`}
                      <span className="text-xs text-stone-400 ml-2">
                        {formatDateTime(decision.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-stone-200 pt-4 space-y-3">
              {showCorrectionForm ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-stone-700">
                    訂正の発行
                  </h3>
                  <CorrectionForm
                    answerRunId={answerRunId}
                    sourceOptions={correctionSourceOptions}
                  />
                </div>
              ) : correctionSourceOptions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowCorrectionForm(true)}
                  className="text-teal-600 hover:text-teal-700 hover:underline text-sm"
                >
                  訂正を作成する
                </button>
              ) : (
                <p className="text-sm text-stone-500">
                  参照したナレッジが無いため訂正は作成できません。情報自体が不足している場合は「情報源不足」を選んでください
                </p>
              )}
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="メモ（任意）"
                rows={2}
                className="w-full rounded-lg border border-stone-200 p-2 text-sm"
              />
              {decisionMutation.isError && (
                <ErrorBanner>{formatError(decisionMutation.error)}</ErrorBanner>
              )}
              <div className="flex gap-2 flex-wrap">
                {DECISION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={decisionMutation.isPending}
                    onClick={() => handleDecide(option.value)}
                    className={`px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${option.className}`}
                  >
                    {REVIEW_DECISION_LABELS[option.value]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};

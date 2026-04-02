import {
  ChartBarIcon,
  ClockIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";

import {
  useCloseQuestionnaire,
  useCreateQuestionnaire,
  useDeleteQuestionnaire,
  useQuestionnaireResults,
  useQuestionnaires,
  useSendQuestionnaire,
  useUpdateQuestionnaire,
} from "~/hooks/useDashboard";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { formatDateTime } from "~/lib/format";
import type {
  CreateQuestionnaireRequest,
  QuestionnaireMessage,
  QuestionnaireStatus,
  QuestionResult,
  QuestionType,
} from "~/types";

const STATUS_LABELS: Record<QuestionnaireStatus, string> = {
  draft: "下書き",
  scheduled: "予約済み",
  sent: "配信中",
  closed: "締切",
};

const STATUS_STYLES: Record<QuestionnaireStatus, string> = {
  draft: "bg-stone-100 text-stone-600",
  scheduled: "bg-blue-100 text-blue-700",
  sent: "bg-green-100 text-green-700",
  closed: "bg-stone-200 text-stone-500",
};

type SendTiming = "draft" | "now" | "schedule";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "単一選択",
  multiple_choice: "複数選択",
  free_text: "自由記述",
  rating: "評価（5段階）",
};

// --- 作成/編集フォーム ---

let formIdCounter = 0;
const nextFormId = () => `qf-${++formIdCounter}`;

type ChoiceFormState = { id: string; value: string };

type QuestionFormState = {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  choices: ChoiceFormState[];
};

const emptyChoice = (): ChoiceFormState => ({ id: nextFormId(), value: "" });

const emptyQuestion = (): QuestionFormState => ({
  id: nextFormId(),
  text: "",
  type: "single_choice",
  required: true,
  choices: [emptyChoice(), emptyChoice()],
});

type FormModalProps = {
  mode: "create" | "edit";
  questionnaire?: QuestionnaireMessage;
  onClose: () => void;
};

const FormModal = ({ mode, questionnaire, onClose }: FormModalProps) => {
  const [title, setTitle] = useState(questionnaire?.title ?? "");
  const [description, setDescription] = useState(
    questionnaire?.description ?? "",
  );
  const [isAnonymous, setIsAnonymous] = useState(
    questionnaire?.isAnonymous ?? true,
  );
  const [questions, setQuestions] = useState<QuestionFormState[]>(() => {
    if (questionnaire?.questions.length) {
      return questionnaire.questions.map((q) => ({
        id: nextFormId(),
        text: q.text,
        type: q.type as QuestionType,
        required: q.required,
        choices: (q.choices ?? []).map((c) => ({ id: nextFormId(), value: c })),
      }));
    }
    return [emptyQuestion()];
  });

  const [timing, setTiming] = useState<SendTiming>(
    questionnaire?.scheduledAt ? "schedule" : "draft",
  );
  const [scheduledAt, setScheduledAt] = useState(
    questionnaire?.scheduledAt?.slice(0, 16) ?? "",
  );

  const createMutation = useCreateQuestionnaire();
  const updateMutation = useUpdateQuestionnaire();

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const addQuestion = () => {
    if (questions.length >= 20) return;
    setQuestions([...questions, emptyQuestion()]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (
    index: number,
    field: keyof QuestionFormState,
    value: unknown,
  ) => {
    setQuestions(
      questions.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    );
  };

  const updateChoice = (qIndex: number, choiceId: string, value: string) => {
    setQuestions(
      questions.map((q, i) =>
        i === qIndex
          ? {
              ...q,
              choices: q.choices.map((c) =>
                c.id === choiceId ? { ...c, value } : c,
              ),
            }
          : q,
      ),
    );
  };

  const addChoice = (qIndex: number) => {
    setQuestions(
      questions.map((q, i) =>
        i === qIndex ? { ...q, choices: [...q.choices, emptyChoice()] } : q,
      ),
    );
  };

  const removeChoice = (qIndex: number, choiceId: string) => {
    setQuestions(
      questions.map((q, i) =>
        i === qIndex
          ? { ...q, choices: q.choices.filter((c) => c.id !== choiceId) }
          : q,
      ),
    );
  };

  const handleSubmit = async () => {
    if (timing === "now") {
      if (!confirm("このアンケートをLINE全フォロワーに即時配信しますか？"))
        return;
    }

    const payload: CreateQuestionnaireRequest = {
      title,
      description: description || undefined,
      isAnonymous,
      questions: questions.map((q) => ({
        text: q.text,
        type: q.type,
        required: q.required,
        ...(q.type === "single_choice" || q.type === "multiple_choice"
          ? { choices: q.choices.map((c) => c.value).filter((v) => v.trim()) }
          : {}),
      })),
      ...(timing === "now" && { sendNow: true }),
      ...(timing === "schedule" && {
        scheduledAt: new Date(scheduledAt).toISOString(),
      }),
    };

    if (mode === "edit" && questionnaire) {
      await updateMutation.mutateAsync({ id: questionnaire.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  };

  const isValid =
    title.trim() &&
    questions.every(
      (q) =>
        q.text.trim() &&
        (q.type === "free_text" ||
          q.type === "rating" ||
          q.choices.filter((c) => c.value.trim()).length >= 2),
    ) &&
    (timing !== "schedule" || scheduledAt.length > 0);

  return (
    <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-[2px] z-50 flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 mb-8">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="text-lg font-semibold text-stone-800">
            {mode === "create" ? "アンケート作成" : "アンケート編集"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 rounded-lg"
          >
            <XMarkIcon className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70dvh] overflow-y-auto">
          {/* タイトル */}
          <div>
            <label
              htmlFor="questionnaire-title"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              タイトル
            </label>
            <input
              id="questionnaire-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="アンケートのタイトル"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* 説明 */}
          <div>
            <label
              htmlFor="questionnaire-description"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              説明（任意）
            </label>
            <textarea
              id="questionnaire-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="アンケートの説明文"
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {/* 無記名/記名 */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
              />
              無記名アンケート
            </label>
          </div>

          {/* 設問一覧 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-stone-700">
                設問（{questions.length}/20）
              </h4>
              <button
                type="button"
                onClick={addQuestion}
                disabled={questions.length >= 20}
                className="flex items-center gap-1 text-sm text-teal-700 hover:text-teal-800 disabled:text-stone-400"
              >
                <PlusIcon className="w-4 h-4" />
                設問追加
              </button>
            </div>

            {questions.map((q, qIndex) => (
              <div
                key={q.id}
                className="border border-stone-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-stone-500 mt-1">
                    Q{qIndex + 1}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="p-1 hover:bg-red-50 rounded text-stone-400 hover:text-red-500"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={q.text}
                  onChange={(e) =>
                    updateQuestion(qIndex, "text", e.target.value)
                  }
                  placeholder="質問文を入力"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />

                <div className="flex items-center gap-3">
                  <select
                    value={q.type}
                    onChange={(e) =>
                      updateQuestion(qIndex, "type", e.target.value)
                    }
                    className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {(
                      Object.entries(QUESTION_TYPE_LABELS) as [
                        QuestionType,
                        string,
                      ][]
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-1.5 text-sm text-stone-600">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) =>
                        updateQuestion(qIndex, "required", e.target.checked)
                      }
                      className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                    />
                    必須
                  </label>
                </div>

                {/* 選択肢（choice系のみ） */}
                {(q.type === "single_choice" ||
                  q.type === "multiple_choice") && (
                  <div className="space-y-2 pl-2">
                    {q.choices.map((choice, cIndex) => (
                      <div key={choice.id} className="flex items-center gap-2">
                        <span className="text-sm text-stone-400 w-4">
                          {cIndex + 1}.
                        </span>
                        <input
                          type="text"
                          value={choice.value}
                          onChange={(e) =>
                            updateChoice(qIndex, choice.id, e.target.value)
                          }
                          placeholder={`選択肢${cIndex + 1}`}
                          className="flex-1 px-2.5 py-1.5 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        {q.choices.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeChoice(qIndex, choice.id)}
                            className="p-1 hover:bg-red-50 rounded text-stone-400 hover:text-red-500"
                          >
                            <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addChoice(qIndex)}
                      className="text-sm text-teal-700 hover:text-teal-800 pl-6"
                    >
                      + 選択肢を追加
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 配信タイミング */}
        <div className="p-5 border-t border-stone-200 space-y-4">
          <div>
            <span className="block text-sm font-medium text-stone-700 mb-2">
              配信タイミング
            </span>
            <div className="flex rounded-lg border border-stone-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setTiming("draft")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  timing === "draft"
                    ? "bg-stone-600 text-white"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <PencilSquareIcon className="w-4 h-4" />
                下書き保存
              </button>
              <button
                type="button"
                onClick={() => setTiming("now")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-l border-stone-300 flex items-center justify-center gap-1.5 ${
                  timing === "now"
                    ? "bg-teal-600 text-white"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <PaperAirplaneIcon className="w-4 h-4" />
                今すぐ配信
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
                htmlFor="questionnaire-scheduled"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                配信日時
              </label>
              <input
                id="questionnaire-scheduled"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className={`px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 ${
                timing === "now"
                  ? "bg-teal-600 hover:bg-teal-700"
                  : timing === "schedule"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-stone-600 hover:bg-stone-700"
              }`}
            >
              {isSubmitting ? (
                "処理中..."
              ) : timing === "now" ? (
                <>
                  <PaperAirplaneIcon className="w-4 h-4" />
                  配信する
                </>
              ) : timing === "schedule" ? (
                <>
                  <ClockIcon className="w-4 h-4" />
                  予約する
                </>
              ) : (
                "保存する"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 結果モーダル ---

const ResultsModal = ({
  questionnaireId,
  onClose,
}: {
  questionnaireId: string;
  onClose: () => void;
}) => {
  const { data: results, isLoading } = useQuestionnaireResults(questionnaireId);

  return (
    <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-[2px] z-50 flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 mb-8">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="text-lg font-semibold text-stone-800">
            回答結果
            {results && (
              <span className="text-sm font-normal text-stone-500 ml-2">
                {results.completedSubmissions}件完了 /{" "}
                {results.totalSubmissions}
                件回答中
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 rounded-lg"
          >
            <XMarkIcon className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[70dvh] overflow-y-auto">
          {isLoading && (
            <p className="text-sm text-stone-500 text-center py-8">
              読み込み中...
            </p>
          )}

          {results?.questionResults.map((qr: QuestionResult, index: number) => (
            <QuestionResultCard key={qr.questionId} result={qr} index={index} />
          ))}

          {results && results.questionResults.length === 0 && (
            <p className="text-sm text-stone-500 text-center py-8">
              まだ回答がありません
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const QuestionResultCard = ({
  result,
  index,
}: {
  result: QuestionResult;
  index: number;
}) => (
  <div className="border border-stone-200 rounded-lg p-4 space-y-3">
    <div className="flex items-center justify-between">
      <h4 className="text-base font-medium text-stone-800">
        Q{index + 1}. {result.questionText}
      </h4>
      <span className="text-sm text-stone-500">
        {result.totalResponses}件回答
      </span>
    </div>

    {/* 選択式 → 棒グラフ */}
    {result.choiceResults && (
      <div className="space-y-2">
        {result.choiceResults.map((cr) => (
          <div key={cr.choice} className="space-y-1">
            <div className="flex items-center justify-between text-sm text-stone-600">
              <span>{cr.choice}</span>
              <span>
                {cr.count}件（{cr.percentage}%）
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
    )}

    {/* 評価 → 平均 + 分布 */}
    {result.averageRating !== undefined && (
      <div className="space-y-2">
        <p className="text-2xl font-bold text-teal-700">
          {result.averageRating}
          <span className="text-sm font-normal text-stone-500"> / 5</span>
        </p>
        {result.ratingDistribution && (
          <div className="flex items-end gap-1 h-16">
            {[1, 2, 3, 4, 5].map((n) => {
              const count = result.ratingDistribution?.[String(n)] ?? 0;
              const max = Math.max(
                ...Object.values(result.ratingDistribution ?? {}),
                1,
              );
              const height = (count / max) * 100;
              return (
                <div
                  key={n}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full bg-teal-400 rounded-t transition-all"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-stone-500">{n}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

    {/* 自由記述 → テキストリスト */}
    {result.freeTextAnswers && result.freeTextAnswers.length > 0 && (
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {result.freeTextAnswers.map((text) => (
          <p
            key={text}
            className="text-sm text-stone-700 bg-stone-50 rounded px-3 py-2"
          >
            {text}
          </p>
        ))}
      </div>
    )}
  </div>
);

// --- メインパネル ---

export const QuestionnairePanel = () => {
  const [statusFilter, setStatusFilter] = useState<
    QuestionnaireStatus | undefined
  >();
  const [modal, setModal] = useState<
    | { type: "create" }
    | { type: "edit"; questionnaire: QuestionnaireMessage }
    | { type: "results"; id: string }
    | null
  >(null);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useQuestionnaires(30, {
      status: statusFilter,
    });

  const deleteMutation = useDeleteQuestionnaire();
  const sendMutation = useSendQuestionnaire();
  const closeMutation = useCloseQuestionnaire();

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    isFetching: isFetchingNextPage,
    onFetch: fetchNextPage,
  });

  const questionnaires = data?.pages.flatMap((p) => p.questionnaires) ?? [];

  const handleSend = useCallback(
    async (id: string) => {
      if (!confirm("このアンケートをLINEに配信しますか？")) return;
      await sendMutation.mutateAsync(id);
    },
    [sendMutation],
  );

  const handleClose = useCallback(
    async (id: string) => {
      if (!confirm("このアンケートの回答受付を締め切りますか？")) return;
      await closeMutation.mutateAsync(id);
    },
    [closeMutation],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("このアンケートを削除しますか？")) return;
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation],
  );

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {(
            [undefined, "draft", "scheduled", "sent", "closed"] as (
              | QuestionnaireStatus
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

      {/* 一覧 */}
      {isLoading && (
        <p className="text-sm text-stone-500 text-center py-8">読み込み中...</p>
      )}

      {!isLoading && questionnaires.length === 0 && (
        <p className="text-sm text-stone-500 text-center py-8">
          アンケートはまだありません
        </p>
      )}

      <div className="space-y-3">
        {questionnaires.map((q) => (
          <div
            key={q.id}
            className="bg-white border border-stone-200 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-stone-800 truncate">
                    {q.title}
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_STYLES[q.status as QuestionnaireStatus]}`}
                  >
                    {STATUS_LABELS[q.status as QuestionnaireStatus]}
                  </span>
                </div>
                {q.description && (
                  <p className="text-sm text-stone-500 mt-1 line-clamp-2">
                    {q.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
                  <span>{q.questions.length}問</span>
                  <span>{formatDateTime(q.createdAt)}</span>
                  {q.scheduledAt && (
                    <span className="text-blue-600">
                      予約: {formatDateTime(q.scheduledAt)}
                    </span>
                  )}
                  {q.sentAt && <span>配信: {formatDateTime(q.sentAt)}</span>}
                  {q.isAnonymous && <span>無記名</span>}
                </div>
              </div>

              {/* アクションボタン */}
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
                      onClick={() =>
                        setModal({ type: "edit", questionnaire: q })
                      }
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

            {/* 設問プレビュー */}
            <div className="flex flex-wrap gap-1.5">
              {q.questions.map((qq, i) => (
                <span
                  key={qq.id}
                  className="text-xs text-stone-500 bg-stone-50 rounded px-2 py-0.5"
                >
                  Q{i + 1}: {QUESTION_TYPE_LABELS[qq.type as QuestionType]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div ref={loadMoreRef} />
      {isFetchingNextPage && (
        <p className="text-xs text-stone-400 text-center py-2">読み込み中...</p>
      )}

      {/* モーダル */}
      {modal?.type === "create" && (
        <FormModal mode="create" onClose={() => setModal(null)} />
      )}
      {modal?.type === "edit" && (
        <FormModal
          mode="edit"
          questionnaire={modal.questionnaire}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "results" && (
        <ResultsModal
          questionnaireId={modal.id}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

import { useState } from "react";
import { CorrectionEditor } from "~/app/dashboard/components/corrections/CorrectionEditor";
import {
  useCorrections,
  usePublishCorrection,
  useRetireCorrection,
  useReverifyCorrection,
} from "~/app/dashboard/hooks/useCorrections";
import { EmptyStateCard } from "~/components/ui/EmptyStateCard";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import { FilterTabs } from "~/components/ui/FilterTabs";
import { PanelLoading } from "~/components/ui/PanelLoading";
import { SearchBox } from "~/components/ui/SearchBox";
import { confirmDialog } from "~/lib/dialog";
import { formatDateTime } from "~/lib/format";

type StatusFilter = "published" | "needs_review" | "draft" | "retired" | "all";

const NEEDS_REVIEW_LABELS = {
  source_updated: "要再確認（元ページが更新されました）",
  source_unavailable: "要再確認（元の情報源が検索対象から外れました）",
} as const;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "published", label: "公開中" },
  { value: "needs_review", label: "要再確認" },
  { value: "draft", label: "未反映" },
  { value: "retired", label: "廃止済み" },
  { value: "all", label: "すべて" },
];

export const CorrectionsPanel = () => {
  const [filter, setFilter] = useState<StatusFilter>("published");
  const [keyword, setKeyword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data, isLoading, error } = useCorrections();
  const retireMutation = useRetireCorrection();
  const reverifyMutation = useReverifyCorrection();
  const publishMutation = usePublishCorrection();

  if (isLoading) {
    return <PanelLoading />;
  }

  if (error) {
    return <ErrorBanner>{formatError(error)}</ErrorBanner>;
  }

  const all = data?.corrections ?? [];
  const needle = keyword.trim().toLowerCase();
  const corrections = all.filter((correction) => {
    if (
      needle &&
      !`${correction.correctsSourcePath}\n${correction.body}`
        .toLowerCase()
        .includes(needle)
    ) {
      return false;
    }
    if (filter === "all") return true;
    if (filter === "needs_review") {
      return correction.status === "published" && !!correction.needsReviewAt;
    }
    return correction.status === filter;
  });
  const needsReviewCount = all.filter(
    (c) => c.status === "published" && c.needsReviewAt,
  ).length;
  const draftCount = all.filter((c) => c.status === "draft").length;

  const handleRetire = (id: string) => {
    if (!confirmDialog("この訂正を廃止しますか？検索対象から外れます。")) {
      return;
    }
    retireMutation.mutate(id);
  };

  return (
    <div className="space-y-4">
      <FilterTabs
        options={FILTERS.map((option) => ({
          value: option.value,
          label:
            option.value === "needs_review" && needsReviewCount > 0
              ? `${option.label} (${needsReviewCount})`
              : option.value === "draft" && draftCount > 0
                ? `${option.label} (${draftCount})`
                : option.label,
        }))}
        value={filter}
        onChange={setFilter}
      />

      <SearchBox
        label="訂正を検索"
        placeholder="情報源のパスや本文で絞り込む"
        value={keyword}
        onChange={setKeyword}
      />

      {(retireMutation.isError ||
        reverifyMutation.isError ||
        publishMutation.isError) && (
        <ErrorBanner>
          {formatError(
            retireMutation.error ??
              reverifyMutation.error ??
              publishMutation.error,
          )}
        </ErrorBanner>
      )}

      {corrections.length === 0 ? (
        <EmptyStateCard>訂正はありません</EmptyStateCard>
      ) : (
        <div className="space-y-3">
          {corrections.map((correction) => (
            <div
              key={correction.id}
              className={`bg-white rounded-xl border border-stone-200 p-4 space-y-2 ${
                correction.status === "retired" ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-stone-600">
                  {correction.correctsSourcePath}
                </span>
                {correction.status === "retired" ? (
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-stone-100 text-stone-500 rounded">
                    廃止済み
                  </span>
                ) : correction.status === "draft" ? (
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                    未反映（回答に反映されていません）
                  </span>
                ) : correction.needsReviewAt ? (
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                      correction.needsReviewReason === "source_unavailable"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {
                      NEEDS_REVIEW_LABELS[
                        correction.needsReviewReason ?? "source_updated"
                      ]
                    }
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 rounded">
                    公開中
                  </span>
                )}
                <span className="text-xs text-stone-400 ml-auto">
                  {correction.verifiedAt} 村確認 ・{" "}
                  {formatDateTime(correction.createdAt)}
                </span>
              </div>
              {editingId === correction.id ? (
                <CorrectionEditor
                  correction={correction}
                  onClose={() => setEditingId(null)}
                />
              ) : (
                <p className="text-sm text-stone-700 whitespace-pre-wrap">
                  {correction.body}
                </p>
              )}
              {correction.status === "draft" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={publishMutation.isPending}
                    onClick={() => publishMutation.mutate(correction.id)}
                    className="px-3 py-1.5 bg-stone-800 text-white text-xs font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
                  >
                    再発行する
                  </button>
                  <button
                    type="button"
                    disabled={retireMutation.isPending}
                    onClick={() => handleRetire(correction.id)}
                    className="px-3 py-1.5 bg-stone-100 text-stone-600 text-xs font-medium rounded-lg hover:bg-stone-200 disabled:opacity-50 transition-colors"
                  >
                    廃止する
                  </button>
                </div>
              )}
              {correction.status === "published" &&
                editingId !== correction.id && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(correction.id)}
                      className="px-3 py-1.5 bg-stone-100 text-stone-600 text-xs font-medium rounded-lg hover:bg-stone-200 transition-colors"
                    >
                      本文を修正する
                    </button>
                    {correction.needsReviewAt && (
                      <button
                        type="button"
                        disabled={reverifyMutation.isPending}
                        onClick={() => reverifyMutation.mutate(correction.id)}
                        className="px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                      >
                        内容を確認した（維持する）
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={retireMutation.isPending}
                      onClick={() => handleRetire(correction.id)}
                      className="px-3 py-1.5 bg-stone-100 text-stone-600 text-xs font-medium rounded-lg hover:bg-stone-200 disabled:opacity-50 transition-colors"
                    >
                      廃止する
                    </button>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

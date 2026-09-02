import { useState } from "react";
import {
  useSourceCandidates,
  useUpdateSourceCandidateStatus,
} from "~/app/dashboard/hooks/useSourceCandidates";
import { EmptyStateCard } from "~/components/ui/EmptyStateCard";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import { FilterTabs } from "~/components/ui/FilterTabs";
import { PanelLoading } from "~/components/ui/PanelLoading";
import { SearchBox } from "~/components/ui/SearchBox";
import { formatDateTime } from "~/lib/format";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "pending", label: "未判断" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下済み" },
  { value: "all", label: "すべて" },
];

export const SourceCandidatesPanel = () => {
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [keyword, setKeyword] = useState("");
  const { data, isLoading, error } = useSourceCandidates();
  const statusMutation = useUpdateSourceCandidateStatus();

  if (isLoading) {
    return <PanelLoading />;
  }

  if (error) {
    return <ErrorBanner>{formatError(error)}</ErrorBanner>;
  }

  const needle = keyword.trim().toLowerCase();
  const candidates = (data?.candidates ?? []).filter(
    (candidate) =>
      (filter === "all" || candidate.status === filter) &&
      (!needle || candidate.url.toLowerCase().includes(needle)),
  );

  return (
    <div className="space-y-4">
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

      <SearchBox
        label="情報源候補を検索"
        placeholder="URL で絞り込む"
        value={keyword}
        onChange={setKeyword}
      />

      {statusMutation.isError && (
        <ErrorBanner>{formatError(statusMutation.error)}</ErrorBanner>
      )}

      {candidates.length === 0 ? (
        <EmptyStateCard>
          情報源の候補はありません。ナレッジに無い質問が Web
          検索で公式ページから回答されたときに、ここへ候補が届きます
        </EmptyStateCard>
      ) : (
        <div className="space-y-3">
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className={`bg-white rounded-xl border border-stone-200 p-4 space-y-2 ${
                candidate.status === "rejected" ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={candidate.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-teal-600 hover:text-teal-700 hover:underline break-all"
                >
                  {candidate.url}
                </a>
                <span className="text-xs text-stone-400 ml-auto whitespace-nowrap">
                  参照 {candidate.occurrenceCount} 回 ・ 最終{" "}
                  {formatDateTime(candidate.lastSeenAt)}
                </span>
              </div>
              {candidate.status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({
                        id: candidate.id,
                        action: "approve",
                      })
                    }
                    className="px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    収集対象として承認
                  </button>
                  <button
                    type="button"
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({
                        id: candidate.id,
                        action: "reject",
                      })
                    }
                    className="px-3 py-1.5 bg-stone-100 text-stone-600 text-xs font-medium rounded-lg hover:bg-stone-200 disabled:opacity-50 transition-colors"
                  >
                    却下
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                      candidate.status === "approved"
                        ? "bg-teal-100 text-teal-700"
                        : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {candidate.status === "approved" ? "承認済み" : "却下済み"}
                  </span>
                  <button
                    type="button"
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({
                        id: candidate.id,
                        action: "reset",
                      })
                    }
                    className="px-3 py-1.5 bg-stone-100 text-stone-600 text-xs font-medium rounded-lg hover:bg-stone-200 disabled:opacity-50 transition-colors"
                  >
                    未判断に戻す
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

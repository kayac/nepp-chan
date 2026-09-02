import { useState } from "react";
import { countByStatus } from "~/app/dashboard/components/knowledge/sources/helpers";
import { SourceRow } from "~/app/dashboard/components/knowledge/sources/SourceRow";
import {
  useKnowledgeSources,
  useUpdateSourceStatus,
} from "~/app/dashboard/hooks/useKnowledgeSources";
import { EmptyStateCard } from "~/components/ui/EmptyStateCard";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import { FilterTabs } from "~/components/ui/FilterTabs";
import { PanelLoading } from "~/components/ui/PanelLoading";

type StatusFilter = "pending" | "approved" | "disabled" | "rejected" | "all";

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "pending", label: "未承認" },
  { value: "approved", label: "公開中" },
  { value: "disabled", label: "停止中" },
  { value: "rejected", label: "却下済み" },
  { value: "all", label: "すべて" },
];

export const SourcesPanel = () => {
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const { data, isLoading, error } = useKnowledgeSources();
  const statusMutation = useUpdateSourceStatus();

  if (isLoading) {
    return <PanelLoading />;
  }

  if (error) {
    return <ErrorBanner>{formatError(error)}</ErrorBanner>;
  }

  const all = data?.sources ?? [];
  const sources = all.filter(
    (source) => filter === "all" || source.approvalStatus === filter,
  );
  const pendingCount = countByStatus(all, "pending");

  return (
    <div className="space-y-4">
      <FilterTabs
        options={FILTERS.map((option) => ({
          value: option.value,
          label:
            option.value === "pending" && pendingCount > 0
              ? `${option.label} (${pendingCount})`
              : option.label,
        }))}
        value={filter}
        onChange={setFilter}
      />

      {statusMutation.isError && (
        <ErrorBanner>{formatError(statusMutation.error)}</ErrorBanner>
      )}

      {sources.length === 0 ? (
        <EmptyStateCard>該当する情報源はありません</EmptyStateCard>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <SourceRow
              key={source.sourcePath}
              source={source}
              isPending={statusMutation.isPending}
              onAction={(action) =>
                statusMutation.mutate({
                  sourcePath: source.sourcePath,
                  action,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

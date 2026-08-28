import { Fragment, useState } from "react";
import {
  useOperationCost,
  useThreadUsage,
} from "~/app/dashboard/hooks/useAnalytics";
import { CostSparkline } from "./CostSparkline";
import {
  agentColor,
  agentLabel,
  formatCostJpy,
  platformLabel,
} from "./helpers";
import {
  SectionCard,
  SectionEmpty,
  SectionError,
  SectionLoading,
} from "./SectionCard";
import { ThreadTurnBreakdown } from "./ThreadTurnBreakdown";

export const CostSection = () => {
  const operation = useOperationCost(30);
  const threadUsage = useThreadUsage(30, 50);
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);

  const isLoading = operation.isLoading || threadUsage.isLoading;
  const error = operation.error ?? threadUsage.error;
  const summary = threadUsage.data?.summary;
  const threads = threadUsage.data?.threads ?? [];
  const byAgent = (summary?.byAgent ?? []).filter(
    (entry) => entry.agent !== null,
  );
  const agentTotal = byAgent.reduce((sum, a) => sum + a.costUsd, 0);
  const maxThreadCost = threads.reduce((max, t) => Math.max(max, t.costUsd), 0);
  const avgMessage = summary?.avgCostPerMessageUsd ?? null;

  return (
    <SectionCard title="コスト">
      {isLoading && <SectionLoading />}
      {error != null && <SectionError error={error} />}
      {summary &&
        operation.data &&
        (summary.threads === 0 ? (
          <SectionEmpty>まだ記録がありません</SectionEmpty>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <p className="text-xs text-(--fg-3)">1 メッセージ平均</p>
                <p className="text-3xl font-medium tabular-nums text-(--fg-1) leading-tight">
                  {avgMessage !== null ? formatCostJpy(avgMessage) : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--fg-3)">30 日合計</p>
                <p className="text-xl font-medium tabular-nums text-(--fg-1) leading-tight">
                  {formatCostJpy(operation.data.totalCostUsd)}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--fg-3)">会話</p>
                <p className="text-xl font-medium tabular-nums text-(--fg-1) leading-tight">
                  {summary.threads.toLocaleString()}
                </p>
              </div>
              {operation.data.daily.length > 1 && (
                <div className="flex-1 min-w-40">
                  <p className="text-xs text-(--fg-3) mb-1">日別</p>
                  <CostSparkline daily={operation.data.daily} />
                </div>
              )}
            </div>

            {byAgent.length > 0 && agentTotal > 0 && (
              <div>
                <p className="text-xs text-(--fg-3) mb-1.5">
                  エージェント別のコスト
                </p>
                <div className="flex h-7 rounded-md overflow-hidden bg-(--bg-sunken)">
                  {byAgent.map((entry) => (
                    <div
                      key={entry.agent ?? "unknown"}
                      style={{
                        width: `${(entry.costUsd / agentTotal) * 100}%`,
                        background: agentColor(entry.agent),
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-(--fg-2)">
                  {byAgent.map((entry) => (
                    <span
                      key={entry.agent ?? "unknown"}
                      className="inline-flex items-center gap-1.5"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ background: agentColor(entry.agent) }}
                      />
                      {agentLabel(entry.agent)}
                      <b className="font-medium tabular-nums text-(--fg-1)">
                        {formatCostJpy(entry.costUsd)}
                      </b>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-auto max-h-[26rem]">
              <table className="w-full text-sm">
                <thead className="bg-(--bg-raised) sticky top-0">
                  <tr className="border-b border-(--border-1)">
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-(--fg-3)">
                      会話
                    </th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-(--fg-3)">
                      チャネル
                    </th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-(--fg-3)">
                      メッセージ
                    </th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-(--fg-3)">
                      コスト
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {threads.map((thread) => {
                    const expanded = expandedThreadId === thread.threadId;
                    return (
                      <Fragment key={thread.threadId}>
                        <tr
                          className="border-b border-(--border-1)/50 cursor-pointer hover:bg-(--bg-sunken)"
                          onClick={() =>
                            setExpandedThreadId(
                              expanded ? null : thread.threadId,
                            )
                          }
                        >
                          <td
                            className="px-2 py-1.5 font-mono text-xs text-(--fg-3)"
                            title={thread.threadId}
                          >
                            {expanded ? "▾" : "▸"} {thread.threadId.slice(0, 8)}
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="inline-block text-xs px-2 rounded-full bg-(--bg-sunken) border border-(--border-1) text-(--fg-2)">
                              {platformLabel(thread.platform)}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-(--fg-2)">
                            {thread.messageCount.toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-(--fg-1) relative">
                            {maxThreadCost > 0 && (
                              <span
                                className="absolute inset-y-1 left-2 rounded-sm bg-(--brand-soft-2)"
                                style={{
                                  width: `calc(${(thread.costUsd / maxThreadCost) * 100}% - 0.5rem)`,
                                }}
                              />
                            )}
                            <span className="relative">
                              {formatCostJpy(thread.costUsd)}
                            </span>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={4} className="px-2 py-2">
                              <ThreadTurnBreakdown threadId={thread.threadId} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </SectionCard>
  );
};

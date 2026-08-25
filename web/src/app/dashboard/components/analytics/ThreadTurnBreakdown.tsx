import { useThreadTurnUsage } from "~/app/dashboard/hooks/useAnalytics";
import {
  agentColor,
  agentLabel,
  formatCostJpy,
  formatJstTime,
} from "./helpers";
import { SectionError, SectionLoading } from "./SectionCard";

interface Props {
  threadId: string;
}

const formatDurationMs = (ms: number | null) =>
  ms === null ? "-" : `${(ms / 1000).toFixed(1)}秒`;

export const ThreadTurnBreakdown = ({ threadId }: Props) => {
  const { data, isLoading, error } = useThreadTurnUsage(threadId);
  const turns = data?.turns ?? [];

  if (isLoading) return <SectionLoading />;
  if (error != null) return <SectionError error={error} />;
  if (turns.length === 0) {
    return (
      <p className="text-xs text-(--fg-3) py-1">
        メッセージ単位の記録がありません
      </p>
    );
  }

  return (
    <div>
      <table className="w-full text-xs">
        <thead className="text-(--fg-3)">
          <tr>
            <th className="px-2 py-1 text-left font-medium">時刻</th>
            <th className="px-2 py-1 text-right font-medium">コスト</th>
            <th className="px-2 py-1 text-right font-medium">トークン</th>
            <th className="px-2 py-1 text-right font-medium">応答時間</th>
            <th className="px-2 py-1 text-left font-medium">内訳</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--border-1)/50">
          {turns.map((turn) => (
            <tr key={turn.turnIndex ?? "unknown"}>
              <td className="px-2 py-1 text-(--fg-2) tabular-nums whitespace-nowrap">
                {turn.answeredAt ? formatJstTime(turn.answeredAt) : "記録前"}
              </td>
              <td className="px-2 py-1 text-right tabular-nums text-(--fg-1)">
                {formatCostJpy(turn.costUsd)}
              </td>
              <td className="px-2 py-1 text-right tabular-nums text-(--fg-2)">
                {turn.totalTokens.toLocaleString()}
              </td>
              <td className="px-2 py-1 text-right tabular-nums text-(--fg-2)">
                {formatDurationMs(turn.durationMs)}
              </td>
              <td className="px-2 py-1 min-w-40">
                {turn.costUsd > 0 && (
                  <span className="group relative block">
                    <span className="flex h-2.5 rounded-sm overflow-hidden bg-(--bg-sunken)">
                      {turn.agents.map((entry) => (
                        <span
                          key={entry.agent ?? "unknown"}
                          style={{
                            width: `${(entry.costUsd / turn.costUsd) * 100}%`,
                            background: agentColor(entry.agent),
                          }}
                        />
                      ))}
                    </span>
                    <span className="hidden group-hover:grid absolute right-0 bottom-full z-10 mb-1 w-max grid-cols-[auto_1fr_auto] gap-x-2 gap-y-0.5 items-center rounded-xl border border-(--border-1) bg-(--bg-raised) px-3 py-2 shadow-lg">
                      {turn.agents.map((entry) => (
                        <span
                          key={entry.agent ?? "unknown"}
                          className="col-span-3 grid grid-cols-subgrid items-center"
                        >
                          <span
                            className="w-2 h-2 rounded-sm"
                            style={{ background: agentColor(entry.agent) }}
                          />
                          <span className="text-(--fg-2)">
                            {agentLabel(entry.agent)}
                          </span>
                          <span className="text-right tabular-nums text-(--fg-1)">
                            {formatCostJpy(entry.costUsd)}
                          </span>
                        </span>
                      ))}
                    </span>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

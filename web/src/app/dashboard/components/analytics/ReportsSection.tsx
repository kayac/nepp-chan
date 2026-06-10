import { cn } from "@nepp-chan/shared/lib/class-merge";
import { useState } from "react";
import {
  useWeeklyReportDetail,
  useWeeklyReports,
} from "~/app/dashboard/hooks/useAnalytics";
import { HourlyChart } from "./HourlyChart";
import {
  SectionCard,
  SectionEmpty,
  SectionError,
  SectionLoading,
} from "./SectionCard";
import { StatCards } from "./StatCards";
import { formatCostUsd } from "./helpers";

const ReportDetail = ({ id }: { id: string }) => {
  const { data, isLoading, error } = useWeeklyReportDetail(id);

  if (isLoading) return <SectionLoading />;
  if (error != null) return <SectionError error={error} />;
  if (!data) return null;

  const { report } = data;

  return (
    <div className="space-y-5 border-t border-stone-200 pt-4">
      <div>
        <h4 className="text-sm font-medium text-stone-700 mb-2">
          今週のハイライト
        </h4>
        <p className="text-sm text-stone-700 whitespace-pre-wrap bg-stone-50 rounded-lg p-4">
          {report.summary}
        </p>
      </div>

      <StatCards
        conversations={report.stats.conversationCount}
        messages={report.stats.messageCount}
        platforms={report.stats.platforms}
      />

      <div>
        <h4 className="text-sm font-medium text-stone-700 mb-2">
          時間帯分布（JST）
        </h4>
        <HourlyChart hourly={report.stats.hourly} height={180} />
      </div>

      {report.stats.usageByModel.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-stone-600">
                  モデル
                </th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">
                  合計トークン
                </th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">
                  コスト
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {report.stats.usageByModel.map((u) => (
                <tr key={u.model}>
                  <td className="px-3 py-2 text-stone-700">{u.model}</td>
                  <td className="px-3 py-2 text-right text-stone-700">
                    {u.totalTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-stone-700">
                    {formatCostUsd(u.costUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const ReportsSection = () => {
  const { data, isLoading, error } = useWeeklyReports();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reports = data?.reports ?? [];

  return (
    <SectionCard
      title="週次レポート"
      description="毎週火曜 5:00 JST に前週分（月〜日）を自動生成"
    >
      {isLoading && <SectionLoading />}
      {error != null && <SectionError error={error} />}
      {data &&
        (reports.length === 0 ? (
          <SectionEmpty>レポートはまだ生成されていません</SectionEmpty>
        ) : (
          <div className="space-y-4">
            <ul className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
              {reports.map((report) => (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId(selectedId === report.id ? null : report.id)
                    }
                    className={cn(
                      "w-full px-4 py-3 text-left hover:bg-stone-50 transition-colors",
                      selectedId === report.id && "bg-teal-50",
                    )}
                  >
                    <div className="text-sm font-medium text-stone-800">
                      {report.periodStart} 〜 {report.periodEnd}
                    </div>
                    <div className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                      {report.summary}
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {selectedId && <ReportDetail id={selectedId} />}
          </div>
        ))}
    </SectionCard>
  );
};

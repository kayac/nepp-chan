import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import {
  useWeeklyReportDetail,
  useWeeklyReports,
} from "~/app/dashboard/hooks/useAnalytics";
import { HourlyChart } from "./HourlyChart";
import { formatCostJpy } from "./helpers";
import {
  SectionCard,
  SectionEmpty,
  SectionError,
  SectionLoading,
} from "./SectionCard";
import { StatCards } from "./StatCards";

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
        <h4 className="text-sm font-medium text-stone-700 mb-2">時間帯分布</h4>
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
                    {formatCostJpy(u.costUsd)}
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
  const foundIndex = reports.findIndex((report) => report.id === selectedId);
  const selectedIndex = foundIndex === -1 ? 0 : foundIndex;
  const selected = reports[selectedIndex];
  const olderReport = reports[selectedIndex + 1];
  const newerReport = reports[selectedIndex - 1];

  return (
    <SectionCard
      title="週次レポート"
      description="毎週火曜 5:00 に前週分（月〜日）を自動生成"
    >
      {isLoading && <SectionLoading />}
      {error != null && <SectionError error={error} />}
      {data &&
        (selected === undefined ? (
          <SectionEmpty>レポートはまだ生成されていません</SectionEmpty>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                aria-label="前の週"
                disabled={olderReport === undefined}
                onClick={() => olderReport && setSelectedId(olderReport.id)}
                className="p-2 rounded text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <div className="relative">
                <select
                  value={selected.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="appearance-none pl-4 pr-9 py-2 border border-stone-300 rounded bg-white text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {reports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.periodStart} 〜 {report.periodEnd}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              </div>
              <button
                type="button"
                aria-label="次の週"
                disabled={newerReport === undefined}
                onClick={() => newerReport && setSelectedId(newerReport.id)}
                className="p-2 rounded text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>

            <ReportDetail id={selected.id} />
          </div>
        ))}
    </SectionCard>
  );
};

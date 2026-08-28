import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useUsageAnalytics } from "~/app/dashboard/hooks/useAnalytics";
import {
  AXIS_STYLE,
  getColorAt,
  NEPP_CHART_COLORS,
  TOOLTIP_STYLE,
} from "~/lib/chart-helpers";
import { formatCostUsd, pivotWeeklyUsage } from "./helpers";
import {
  SectionCard,
  SectionEmpty,
  SectionError,
  SectionLoading,
} from "./SectionCard";

export const UsageSection = () => {
  const { data, isLoading, error } = useUsageAnalytics(12);
  const weekly = data?.weekly ?? [];
  const { models, rows } = pivotWeeklyUsage(weekly);
  const totalCost = weekly.reduce((sum, w) => sum + w.costUsd, 0);

  return (
    <SectionCard
      title="トークン消費・コスト"
      description="週ごと・モデルごとのトークン量と概算コスト（週初め = 月曜）"
    >
      {isLoading && <SectionLoading />}
      {error != null && <SectionError error={error} />}
      {data &&
        (weekly.length === 0 ? (
          <SectionEmpty>
            まだ記録がありません（記録開始以降のデータが貯まると表示されます）
          </SectionEmpty>
        ) : (
          <div className="space-y-6">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={rows}
                margin={{ top: 10, right: 20, bottom: 0, left: 8 }}
              >
                <XAxis
                  dataKey="weekStart"
                  tick={AXIS_STYLE}
                  stroke={AXIS_STYLE.stroke}
                  tickFormatter={(date: string) => date.slice(5)}
                />
                <YAxis
                  tick={AXIS_STYLE}
                  stroke={AXIS_STYLE.stroke}
                  tickFormatter={(value: number) => value.toLocaleString()}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [
                    Number(value).toLocaleString(),
                    undefined,
                  ]}
                />
                <Legend />
                {models.map((model, index) => (
                  <Bar
                    key={model}
                    dataKey={model}
                    stackId="tokens"
                    fill={getColorAt(index, NEPP_CHART_COLORS)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-auto max-h-[32rem]">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-stone-600">
                      週
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-stone-600">
                      モデル
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-stone-600">
                      入力
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-stone-600">
                      出力
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
                  {[...weekly].reverse().map((w) => (
                    <tr key={`${w.weekStart}-${w.model}`}>
                      <td className="px-3 py-2 text-stone-700">
                        {w.weekStart}
                      </td>
                      <td className="px-3 py-2 text-stone-700">{w.model}</td>
                      <td className="px-3 py-2 text-right text-stone-700">
                        {w.inputTokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-stone-700">
                        {w.outputTokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-stone-700">
                        {w.totalTokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-stone-700">
                        {formatCostUsd(w.costUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-stone-200">
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-2 text-right font-medium text-stone-600"
                    >
                      合計コスト
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-stone-800">
                      {formatCostUsd(totalCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}
    </SectionCard>
  );
};

import { Fragment, useState } from "react";
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
import {
  formatCostJpy,
  groupUsageByDate,
  pivotDailyUsage,
  USD_JPY_RATE,
} from "./helpers";
import {
  SectionCard,
  SectionEmpty,
  SectionError,
  SectionLoading,
} from "./SectionCard";

const DAYS = 30;

export const UsageSection = () => {
  const { data, isLoading, error } = useUsageAnalytics(DAYS);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const daily = data?.daily ?? [];
  const { models, rows } = pivotDailyUsage(daily);
  const byDate = groupUsageByDate(daily);
  const totalCost = daily.reduce((sum, d) => sum + d.costUsd, 0);
  const totalTokens = daily.reduce((sum, d) => sum + d.totalTokens, 0);
  const maxDateCost = byDate.reduce((max, d) => Math.max(max, d.costUsd), 0);
  const modelColor = (model: string) =>
    getColorAt(models.indexOf(model), NEPP_CHART_COLORS);

  return (
    <SectionCard
      title="トークン消費・コスト"
      description={`日ごと・モデルごとのトークン量と概算コスト（日付は JST、金額は 1USD=${USD_JPY_RATE}円 換算）`}
    >
      {isLoading && <SectionLoading />}
      {error != null && <SectionError error={error} />}
      {data &&
        (daily.length === 0 ? (
          <SectionEmpty>
            まだ記録がありません（記録開始以降のデータが貯まると表示されます）
          </SectionEmpty>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <p className="text-xs text-(--fg-3)">{DAYS} 日合計</p>
                <p className="text-3xl font-medium tabular-nums text-(--fg-1) leading-tight">
                  {formatCostJpy(totalCost)}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--fg-3)">1 日平均</p>
                <p className="text-xl font-medium tabular-nums text-(--fg-1) leading-tight">
                  {formatCostJpy(totalCost / byDate.length)}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--fg-3)">合計トークン</p>
                <p className="text-xl font-medium tabular-nums text-(--fg-1) leading-tight">
                  {totalTokens.toLocaleString()}
                </p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={rows}
                margin={{ top: 10, right: 20, bottom: 0, left: 8 }}
              >
                <XAxis
                  dataKey="date"
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
                {models.map((model) => (
                  <Bar
                    key={model}
                    dataKey={model}
                    stackId="tokens"
                    fill={modelColor(model)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-auto max-h-[26rem]">
              <table className="w-full text-sm">
                <thead className="bg-(--bg-raised) sticky top-0">
                  <tr className="border-b border-(--border-1)">
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-(--fg-3)">
                      日付
                    </th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-(--fg-3)">
                      モデル
                    </th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-(--fg-3)">
                      トークン
                    </th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-(--fg-3)">
                      コスト
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byDate.map((day) => {
                    const expanded = expandedDate === day.date;
                    return (
                      <Fragment key={day.date}>
                        <tr
                          className="border-b border-(--border-1)/50 cursor-pointer hover:bg-(--bg-sunken)"
                          onClick={() =>
                            setExpandedDate(expanded ? null : day.date)
                          }
                        >
                          <td className="px-2 py-1.5 tabular-nums text-(--fg-2) whitespace-nowrap">
                            {expanded ? "▾" : "▸"} {day.date}
                          </td>
                          <td className="px-2 py-1.5 min-w-32">
                            <span className="flex h-2.5 rounded-sm overflow-hidden bg-(--bg-sunken)">
                              {day.models.map((entry) => (
                                <span
                                  key={entry.model}
                                  title={entry.model}
                                  style={{
                                    width: `${(entry.totalTokens / day.totalTokens) * 100}%`,
                                    background: modelColor(entry.model),
                                  }}
                                />
                              ))}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-(--fg-2)">
                            {day.totalTokens.toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-(--fg-1) relative">
                            {maxDateCost > 0 && (
                              <span
                                className="absolute inset-y-1 left-2 rounded-sm bg-(--brand-soft-2)"
                                style={{
                                  width: `calc(${(day.costUsd / maxDateCost) * 100}% - 0.5rem)`,
                                }}
                              />
                            )}
                            <span className="relative">
                              {formatCostJpy(day.costUsd)}
                            </span>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={4} className="px-2 py-2">
                              <table className="w-full text-xs">
                                <thead className="text-(--fg-3)">
                                  <tr>
                                    <th className="px-2 py-1 text-left font-medium">
                                      モデル
                                    </th>
                                    <th className="px-2 py-1 text-right font-medium">
                                      入力
                                    </th>
                                    <th className="px-2 py-1 text-right font-medium">
                                      出力
                                    </th>
                                    <th className="px-2 py-1 text-right font-medium">
                                      合計トークン
                                    </th>
                                    <th className="px-2 py-1 text-right font-medium">
                                      コスト
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-(--border-1)/50">
                                  {day.models.map((entry) => (
                                    <tr key={entry.model}>
                                      <td className="px-2 py-1 text-(--fg-2)">
                                        <span className="inline-flex items-center gap-1.5">
                                          <span
                                            className="w-2 h-2 rounded-sm"
                                            style={{
                                              background: modelColor(
                                                entry.model,
                                              ),
                                            }}
                                          />
                                          {entry.model}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1 text-right tabular-nums text-(--fg-2)">
                                        {entry.inputTokens.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-1 text-right tabular-nums text-(--fg-2)">
                                        {entry.outputTokens.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-1 text-right tabular-nums text-(--fg-2)">
                                        {entry.totalTokens.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-1 text-right tabular-nums text-(--fg-1)">
                                        {formatCostJpy(entry.costUsd)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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

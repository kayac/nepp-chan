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
  groupUsageByMonth,
  jstCurrentMonth,
  pivotDailyUsage,
  USD_JPY_RATE,
} from "./helpers";
import {
  SectionCard,
  SectionEmpty,
  SectionError,
  SectionLoading,
} from "./SectionCard";

const DAYS = 180;
const CHART_DAYS = 30;

export const UsageSection = () => {
  const { data, isLoading, error } = useUsageAnalytics(DAYS);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(
    jstCurrentMonth(),
  );
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const daily = data?.daily ?? [];
  const byMonth = groupUsageByMonth(daily);
  const currentMonth = jstCurrentMonth();
  const thisMonth = byMonth.find((m) => m.month === currentMonth);
  const lastMonth = byMonth.find((m) => m.month < currentMonth);
  const maxMonthCost = byMonth.reduce((max, m) => Math.max(max, m.costUsd), 0);
  const maxDayCost = byMonth.reduce(
    (max, m) => Math.max(max, ...m.days.map((d) => d.costUsd)),
    0,
  );

  const chartDates = [...new Set(daily.map((d) => d.date))]
    .sort()
    .slice(-CHART_DAYS);
  const { models: chartModels, rows } = pivotDailyUsage(
    daily.filter((d) => chartDates.includes(d.date)),
  );

  const allModels = [...new Set(daily.map((d) => d.model))];
  const modelColor = (model: string) =>
    getColorAt(allModels.indexOf(model), NEPP_CHART_COLORS);

  return (
    <SectionCard
      title="トークン消費・コスト"
      description={`月ごとの合計と、日別・モデル別の内訳（日付は JST、金額は 1USD=${USD_JPY_RATE}円 換算）`}
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
                <p className="text-xs text-(--fg-3)">今月</p>
                <p className="text-3xl font-medium tabular-nums text-(--fg-1) leading-tight">
                  {thisMonth ? formatCostJpy(thisMonth.costUsd) : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--fg-3)">先月</p>
                <p className="text-xl font-medium tabular-nums text-(--fg-1) leading-tight">
                  {lastMonth ? formatCostJpy(lastMonth.costUsd) : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--fg-3)">今月の 1 日平均</p>
                <p className="text-xl font-medium tabular-nums text-(--fg-1) leading-tight">
                  {thisMonth
                    ? formatCostJpy(thisMonth.costUsd / thisMonth.days.length)
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--fg-3)">今月のトークン</p>
                <p className="text-xl font-medium tabular-nums text-(--fg-1) leading-tight">
                  {thisMonth ? thisMonth.totalTokens.toLocaleString() : "-"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-(--fg-3) mb-1">
                直近 {CHART_DAYS} 日のトークン量
              </p>
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
                  {chartModels.map((model) => (
                    <Bar
                      key={model}
                      dataKey={model}
                      stackId="tokens"
                      fill={modelColor(model)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-auto max-h-[26rem]">
              <table className="w-full text-sm">
                <thead className="bg-(--bg-raised) sticky top-0">
                  <tr className="border-b border-(--border-1)">
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-(--fg-3)">
                      期間
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
                  {byMonth.map((month) => {
                    const monthExpanded = expandedMonth === month.month;
                    return (
                      <Fragment key={month.month}>
                        <tr
                          className="border-b border-(--border-1)/50 cursor-pointer hover:bg-(--bg-sunken)"
                          onClick={() =>
                            setExpandedMonth(monthExpanded ? null : month.month)
                          }
                        >
                          <td className="px-2 py-1.5 font-medium tabular-nums text-(--fg-1) whitespace-nowrap">
                            {monthExpanded ? "▾" : "▸"} {month.month}
                          </td>
                          <td className="px-2 py-1.5 min-w-32">
                            <span className="flex h-2.5 rounded-sm overflow-hidden bg-(--bg-sunken)">
                              {month.models.map((entry) => (
                                <span
                                  key={entry.model}
                                  title={entry.model}
                                  style={{
                                    width: `${(entry.totalTokens / month.totalTokens) * 100}%`,
                                    background: modelColor(entry.model),
                                  }}
                                />
                              ))}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-(--fg-2)">
                            {month.totalTokens.toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-medium text-(--fg-1) relative">
                            {maxMonthCost > 0 && (
                              <span
                                className="absolute inset-y-1 left-2 rounded-sm bg-(--brand-soft-2)"
                                style={{
                                  width: `calc(${(month.costUsd / maxMonthCost) * 100}% - 0.5rem)`,
                                }}
                              />
                            )}
                            <span className="relative">
                              {formatCostJpy(month.costUsd)}
                            </span>
                          </td>
                        </tr>
                        {monthExpanded &&
                          month.days.map((day) => {
                            const dayExpanded = expandedDate === day.date;
                            return (
                              <Fragment key={day.date}>
                                <tr
                                  className="border-b border-(--border-1)/50 cursor-pointer hover:bg-(--bg-sunken)"
                                  onClick={() =>
                                    setExpandedDate(
                                      dayExpanded ? null : day.date,
                                    )
                                  }
                                >
                                  <td className="pl-6 pr-2 py-1.5 text-xs tabular-nums text-(--fg-2) whitespace-nowrap">
                                    {dayExpanded ? "▾" : "▸"} {day.date}
                                  </td>
                                  <td className="px-2 py-1.5 min-w-32">
                                    <span className="flex h-1.5 rounded-sm overflow-hidden bg-(--bg-sunken)">
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
                                  <td className="px-2 py-1.5 text-right text-xs tabular-nums text-(--fg-2)">
                                    {day.totalTokens.toLocaleString()}
                                  </td>
                                  <td className="px-2 py-1.5 text-right text-xs tabular-nums text-(--fg-2) relative">
                                    {maxDayCost > 0 && (
                                      <span
                                        className="absolute inset-y-1 left-2 rounded-sm bg-(--brand-soft-2)/60"
                                        style={{
                                          width: `calc(${(day.costUsd / maxDayCost) * 100}% - 0.5rem)`,
                                        }}
                                      />
                                    )}
                                    <span className="relative">
                                      {formatCostJpy(day.costUsd)}
                                    </span>
                                  </td>
                                </tr>
                                {dayExpanded && (
                                  <tr>
                                    <td colSpan={4} className="pl-6 pr-2 py-2">
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

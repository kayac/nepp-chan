import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_STYLE, TOOLTIP_STYLE } from "~/lib/chart-helpers";
import {
  formatCostJpy,
  pivotDailyPurposes,
  purposeColor,
  purposeLabel,
} from "./helpers";

interface Props {
  daily: { date: string; purposes: { purpose: string; costUsd: number }[] }[];
}

export const DailyPurposeChart = ({ daily }: Props) => {
  const { purposes, rows } = pivotDailyPurposes(daily);
  if (purposes.length === 0) return null;

  return (
    <div>
      <p className="text-xs text-(--fg-3) mb-1">日別の用途内訳</p>
      <ResponsiveContainer width="100%" height={240}>
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
            tickFormatter={(value: number) => formatCostJpy(value)}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [
              formatCostJpy(Number(value)),
              purposeLabel(String(name)),
            ]}
          />
          <Legend formatter={(name) => purposeLabel(String(name))} />
          {purposes.map((purpose) => (
            <Bar
              key={purpose}
              dataKey={purpose}
              stackId="cost"
              fill={purposeColor(purpose)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

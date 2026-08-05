import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_STYLE,
  CLOSED_COLOR,
  OPEN_COLOR,
  TOOLTIP_STYLE,
} from "~/lib/chart-helpers";

export type DailyBar = {
  date: string;
  label: string;
  conversations: number;
  closed: boolean;
};

interface Props {
  bars: DailyBar[];
}

export const WeekTrendChart = ({ bars }: Props) => (
  <ResponsiveContainer width="100%" height={140}>
    <BarChart data={bars} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
      <XAxis dataKey="label" tick={AXIS_STYLE} stroke={AXIS_STYLE.stroke} />
      <YAxis
        tick={AXIS_STYLE}
        stroke={AXIS_STYLE.stroke}
        allowDecimals={false}
        width={28}
      />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        formatter={(value) => [value, "会話数"]}
      />
      <Bar dataKey="conversations" radius={[4, 4, 0, 0]}>
        {bars.map((bar) => (
          <Cell key={bar.date} fill={bar.closed ? CLOSED_COLOR : OPEN_COLOR} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

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
  TOOLTIP_STYLE,
} from "~/components/chat/tool-uis/chart-helpers";

const OPEN_COLOR = "#0d9488"; // teal-600
const CLOSED_COLOR = "#d97706"; // amber-600

// 役場の開庁時間は 8〜17 時（JST）
const isClosedHour = (hour: number) => hour < 8 || hour >= 17;

interface HourlyChartProps {
  hourly: { hour: number; count: number }[];
  height?: number;
}

export const HourlyChart = ({ hourly, height = 220 }: HourlyChartProps) => (
  <div>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={hourly}
        margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
      >
        <XAxis
          dataKey="hour"
          tick={AXIS_STYLE}
          stroke={AXIS_STYLE.stroke}
          tickFormatter={(hour: number) => `${hour}時`}
          interval={2}
        />
        <YAxis
          tick={AXIS_STYLE}
          stroke={AXIS_STYLE.stroke}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(hour) => `${hour}時台`}
          formatter={(value) => [value, "メッセージ数"]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {hourly.map((item) => (
            <Cell
              key={item.hour}
              fill={isClosedHour(item.hour) ? CLOSED_COLOR : OPEN_COLOR}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    <div className="flex items-center gap-4 justify-center text-xs text-stone-600 mt-1">
      <span className="flex items-center gap-1.5">
        <span
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: OPEN_COLOR }}
        />
        役場開庁時間（8〜17時）
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: CLOSED_COLOR }}
        />
        閉庁時間
      </span>
    </div>
  </div>
);

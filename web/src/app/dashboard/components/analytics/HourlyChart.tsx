import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_STYLE, TOOLTIP_STYLE } from "~/lib/chart-helpers";

// ねっぷちゃんブランドパレット（teal=ベレー帽 / apricot=頬）
const OPEN_COLOR = "#5cb7bb"; // teal-500
const CLOSED_COLOR = "#f4a06a"; // apricot-500

// 役場の開庁時間は 8〜17 時（JST）
const isClosedHour = (hour: number) => hour < 8 || hour >= 17;

interface Props {
  hourly: { hour: number; count: number }[];
  height?: number;
  tooltipLabel?: string;
}

export const HourlyChart = ({
  hourly,
  height = 220,
  tooltipLabel = "メッセージ数",
}: Props) => (
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
          formatter={(value) => [value, tooltipLabel]}
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

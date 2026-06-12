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

// ねっぷちゃんブランドパレット（teal=ベレー帽 / apricot=頬）。HourlyChart と統一
const OPEN_COLOR = "#5cb7bb"; // teal-500
const CLOSED_COLOR = "#f4a06a"; // apricot-500

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 役場の閉庁日は土日
const isClosedDay = (dow: number) => dow === 0 || dow === 6;

interface Props {
  weekday: { dow: number; count: number }[];
  height?: number;
  tooltipLabel?: string;
}

export const WeekdayChart = ({
  weekday,
  height = 220,
  tooltipLabel = "メッセージ数",
}: Props) => (
  <div>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={weekday}
        margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
      >
        <XAxis
          dataKey="dow"
          tick={AXIS_STYLE}
          stroke={AXIS_STYLE.stroke}
          tickFormatter={(dow: number) => DOW_LABELS[dow] ?? String(dow)}
        />
        <YAxis
          tick={AXIS_STYLE}
          stroke={AXIS_STYLE.stroke}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(dow) => `${DOW_LABELS[Number(dow)] ?? dow}曜日`}
          formatter={(value) => [value, tooltipLabel]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {weekday.map((item) => (
            <Cell
              key={item.dow}
              fill={isClosedDay(item.dow) ? CLOSED_COLOR : OPEN_COLOR}
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
        開庁日（月〜金）
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: CLOSED_COLOR }}
        />
        閉庁日（土日）
      </span>
    </div>
  </div>
);

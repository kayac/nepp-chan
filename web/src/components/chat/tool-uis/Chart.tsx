import type { DisplayChartArgs } from "@nepp-chan/shared/schemas/display-tools";
import { BarChartIcon, LineChartIcon, PieChartIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AXIS_STYLE,
  formatPiePercent,
  getColorAt,
  TOOLTIP_STYLE,
} from "~/lib/chart-helpers";

export type ChartType = DisplayChartArgs["type"];

export type ChartArgs = DisplayChartArgs;

const ChartIcon = ({ type }: { type: ChartType }) => {
  switch (type) {
    case "line":
      return <LineChartIcon className="size-5 text-teal-600" />;
    case "bar":
      return <BarChartIcon className="size-5 text-teal-600" />;
    case "pie":
      return <PieChartIcon className="size-5 text-teal-600" />;
  }
};

const LineChartComponent = ({ args }: { args: ChartArgs }) => {
  const { xKey, yKey } = args;
  const color = getColorAt(0);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart
        data={args.data}
        margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
      >
        <XAxis dataKey={xKey} tick={AXIS_STYLE} stroke={AXIS_STYLE.stroke} />
        <YAxis tick={AXIS_STYLE} stroke={AXIS_STYLE.stroke} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2.5}
          dot={{ fill: color, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

const BarChartComponent = ({ args }: { args: ChartArgs }) => {
  const { xKey, yKey } = args;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={args.data}
        margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
      >
        <XAxis dataKey={xKey} tick={AXIS_STYLE} stroke={AXIS_STYLE.stroke} />
        <YAxis tick={AXIS_STYLE} stroke={AXIS_STYLE.stroke} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey={yKey} fill={getColorAt(0)} radius={[8, 8, 0, 0]}>
          {args.data.map((item, index) => (
            <Cell key={String(item[xKey])} fill={getColorAt(index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const PieChartComponent = ({ args }: { args: ChartArgs }) => {
  const { xKey, yKey } = args;

  return (
    <ResponsiveContainer width="100%" height={360}>
      <PieChart>
        <Pie
          data={args.data}
          cx="50%"
          cy="45%"
          outerRadius={120}
          fill="#ea580c"
          dataKey={yKey}
          nameKey={xKey}
          label={({ cx, cy, midAngle = 0, outerRadius, percent }) => {
            const RADIAN = Math.PI / 180;
            const radius = outerRadius * 0.6;
            const x = cx + radius * Math.cos(-midAngle * RADIAN);
            const y = cy + radius * Math.sin(-midAngle * RADIAN);
            return (
              <text
                x={x}
                y={y}
                fill="#fff"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontWeight={500}
              >
                {formatPiePercent(percent)}
              </text>
            );
          }}
          labelLine={false}
        >
          {args.data.map((item, index) => (
            <Cell key={String(item[xKey])} fill={getColorAt(index)} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ paddingTop: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const Chart = ({ args }: { args: ChartArgs }) => (
  <div className="rounded-2xl bg-white p-5 shadow-md ring-1 ring-stone-200">
    {args.title && (
      <div className="mb-4 flex items-center gap-2 border-b border-stone-100 pb-3">
        <ChartIcon type={args.type} />
        <h3 className="font-medium text-stone-700">{args.title}</h3>
      </div>
    )}

    {args.type === "line" && <LineChartComponent args={args} />}
    {args.type === "bar" && <BarChartComponent args={args} />}
    {args.type === "pie" && <PieChartComponent args={args} />}
  </div>
);

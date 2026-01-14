import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { makeAssistantToolUI } from "@assistant-ui/react";
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

type ChartType = "line" | "bar" | "pie";

type ChartData = {
  name: string;
  value: number;
  [key: string]: unknown;
};

type ChartArgs = {
  title?: string;
  type: ChartType;
  data: ChartData[];
  xKey?: string;
  yKey?: string;
  colors?: string[];
};

type ChartResult = {
  displayed: boolean;
};

const DEFAULT_COLORS = [
  "#ea580c", // orange-600
  "#0284c7", // sky-600
  "#16a34a", // green-600
  "#e11d48", // rose-600
  "#ca8a04", // yellow-600
  "#0891b2", // cyan-600
  "#dc2626", // red-600
  "#2563eb", // blue-600
];

const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e7e5e4",
  borderRadius: "12px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  padding: "8px 12px",
};

const AXIS_STYLE = {
  stroke: "#a8a29e",
  fontSize: 12,
};

const LoadingState = () => (
  <div className="rounded-2xl bg-linear-to-r from-teal-50 to-cyan-50 p-5">
    <div className="flex items-center gap-2">
      <BarChartIcon className="size-5 animate-pulse text-teal-400" />
      <div className="h-4 w-32 animate-pulse rounded bg-teal-200" />
    </div>
    <div className="mt-4 h-48 animate-pulse rounded-xl bg-teal-100" />
  </div>
);

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
  const xKey = args.xKey || "name";
  const yKey = args.yKey || "value";
  const colors = args.colors || DEFAULT_COLORS;

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
          stroke={colors[0]}
          strokeWidth={2.5}
          dot={{ fill: colors[0], strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: colors[0] }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

const BarChartComponent = ({ args }: { args: ChartArgs }) => {
  const xKey = args.xKey || "name";
  const yKey = args.yKey || "value";
  const colors = args.colors || DEFAULT_COLORS;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={args.data}
        margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
      >
        <XAxis dataKey={xKey} tick={AXIS_STYLE} stroke={AXIS_STYLE.stroke} />
        <YAxis tick={AXIS_STYLE} stroke={AXIS_STYLE.stroke} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey={yKey} fill={colors[0]} radius={[8, 8, 0, 0]}>
          {args.data.map((item, index) => (
            <Cell key={item.name} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const PieChartComponent = ({ args }: { args: ChartArgs }) => {
  const colors = args.colors || DEFAULT_COLORS;

  return (
    <ResponsiveContainer width="100%" height={360}>
      <PieChart>
        <Pie
          data={args.data}
          cx="50%"
          cy="45%"
          outerRadius={120}
          fill="#ea580c"
          dataKey="value"
          label={({ cx, cy, midAngle, outerRadius, percent }) => {
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
                {`${((percent ?? 0) * 100).toFixed(0)}%`}
              </text>
            );
          }}
          labelLine={false}
        >
          {args.data.map((item, index) => (
            <Cell key={item.name} fill={colors[index % colors.length]} />
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

const Chart = ({ args }: { args: ChartArgs }) => (
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

export const DisplayChartToolComponent: ToolCallMessagePartComponent = ({
  args,
  status,
}) => {
  const chartArgs = args as unknown as ChartArgs;

  if (status?.type === "running" && !chartArgs.data) {
    return (
      <div className="my-4">
        <LoadingState />
      </div>
    );
  }

  if (!chartArgs.data || chartArgs.data.length === 0) {
    return (
      <div className="my-4 rounded-2xl bg-stone-50 p-5 text-stone-600">
        表示するデータがありません
      </div>
    );
  }

  return (
    <div className="my-4">
      <Chart args={chartArgs} />
    </div>
  );
};

export const ChartToolUI = makeAssistantToolUI<ChartArgs, ChartResult>({
  toolName: "displayChartTool",
  render: ({ args, status }) => {
    if (status.type === "running" && !args.data) {
      return (
        <div className="my-4">
          <LoadingState />
        </div>
      );
    }

    if (!args.data || args.data.length === 0) {
      return (
        <div className="my-4 rounded-2xl bg-stone-50 p-5 text-stone-600">
          表示するデータがありません
        </div>
      );
    }

    return (
      <div className="my-4">
        <Chart args={args} />
      </div>
    );
  },
});

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { BarChartIcon, LineChartIcon, PieChartIcon } from "lucide-react";
import type { FC } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  "#6366f1", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
];

const LoadingState: FC = () => (
  <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 p-4">
    <div className="flex items-center gap-2">
      <BarChartIcon className="size-5 animate-pulse text-indigo-400" />
      <div className="h-4 w-32 animate-pulse rounded bg-indigo-200" />
    </div>
    <div className="mt-4 h-48 animate-pulse rounded-lg bg-indigo-100" />
  </div>
);

const ChartIcon: FC<{ type: ChartType }> = ({ type }) => {
  switch (type) {
    case "line":
      return <LineChartIcon className="size-5 text-indigo-500" />;
    case "bar":
      return <BarChartIcon className="size-5 text-indigo-500" />;
    case "pie":
      return <PieChartIcon className="size-5 text-indigo-500" />;
  }
};

const LineChartComponent: FC<{ args: ChartArgs }> = ({ args }) => {
  const xKey = args.xKey || "name";
  const yKey = args.yKey || "value";
  const colors = args.colors || DEFAULT_COLORS;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart
        data={args.data}
        margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={colors[0]}
          strokeWidth={2}
          dot={{ fill: colors[0], strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

const BarChartComponent: FC<{ args: ChartArgs }> = ({ args }) => {
  const xKey = args.xKey || "name";
  const yKey = args.yKey || "value";
  const colors = args.colors || DEFAULT_COLORS;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={args.data}
        margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        />
        <Legend />
        <Bar dataKey={yKey} fill={colors[0]} radius={[4, 4, 0, 0]}>
          {args.data.map((item) => (
            <Cell
              key={item.name}
              fill={colors[args.data.indexOf(item) % colors.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const PieChartComponent: FC<{ args: ChartArgs }> = ({ args }) => {
  const colors = args.colors || DEFAULT_COLORS;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={args.data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) =>
            `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {args.data.map((item) => (
            <Cell
              key={item.name}
              fill={colors[args.data.indexOf(item) % colors.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

const Chart: FC<{ args: ChartArgs }> = ({ args }) => (
  <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
    {args.title && (
      <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
        <ChartIcon type={args.type} />
        <h3 className="font-medium text-gray-700">{args.title}</h3>
      </div>
    )}

    {args.type === "line" && <LineChartComponent args={args} />}
    {args.type === "bar" && <BarChartComponent args={args} />}
    {args.type === "pie" && <PieChartComponent args={args} />}
  </div>
);

/**
 * MessagePrimitive.Parts の tools.by_name で使用するコンポーネント
 */
export const DisplayChartToolComponent: ToolCallMessagePartComponent = ({
  args,
  status,
}) => {
  console.log("[DisplayChartToolComponent] render called", { args, status });

  const chartArgs = args as unknown as ChartArgs;

  if (status?.type === "running" && !chartArgs.data) {
    return <LoadingState />;
  }

  if (!chartArgs.data || chartArgs.data.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 p-4 text-gray-600">
        表示するデータがありません
      </div>
    );
  }

  return <Chart args={chartArgs} />;
};

/**
 * AssistantRuntimeProvider 内で登録する用のコンポーネント
 */
export const ChartToolUI = makeAssistantToolUI<ChartArgs, ChartResult>({
  toolName: "displayChartTool",
  render: ({ args, status }) => {
    console.log("[ChartToolUI] render called", { args, status });

    if (status.type === "running" && !args.data) {
      return <LoadingState />;
    }

    if (!args.data || args.data.length === 0) {
      return (
        <div className="rounded-xl bg-gray-50 p-4 text-gray-600">
          表示するデータがありません
        </div>
      );
    }

    return <Chart args={args} />;
  },
});

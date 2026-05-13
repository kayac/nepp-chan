import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { ToolEmptyState } from "@nepp-chan/shared/ui/EmptyState";
import { ToolLoadingState } from "@nepp-chan/shared/ui/Loading";
import { BarChartIcon } from "lucide-react";

import { Chart, type ChartArgs } from "./Chart";

type ChartResult = {
  displayed: boolean;
};

const renderChart = (args: ChartArgs, isRunning: boolean) => {
  if (isRunning && !args.data) {
    return (
      <div className="my-4">
        <ToolLoadingState
          variant="chart"
          icon={<BarChartIcon className="size-5 animate-pulse text-teal-400" />}
        />
      </div>
    );
  }

  if (!args.data || args.data.length === 0) {
    return (
      <div className="my-4">
        <ToolEmptyState message="表示するデータがありません" />
      </div>
    );
  }

  return (
    <div className="my-4">
      <Chart args={args} />
    </div>
  );
};

export const DisplayChartToolComponent: ToolCallMessagePartComponent = ({
  args,
  status,
}) => renderChart(args as unknown as ChartArgs, status?.type === "running");

export const ChartToolUI = makeAssistantToolUI<ChartArgs, ChartResult>({
  toolName: "displayChartTool",
  render: ({ args, status }) => renderChart(args, status.type === "running"),
});

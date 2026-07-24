import { ChartBarIcon } from "@heroicons/react/24/outline";
import { displayChartSchema } from "@nepp-chan/shared/schemas/display-tools";
import { ToolLoadingState } from "@nepp-chan/shared/ui/Loading";

import { Chart } from "./Chart";
import { defineToolUI } from "./define-tool-ui";

export const DisplayChartToolComponent = defineToolUI({
  schema: displayChartSchema,
  loading: (
    <ToolLoadingState
      variant="chart"
      icon={<ChartBarIcon className="size-5 animate-pulse text-teal-400" />}
    />
  ),
  emptyMessage: "表示するデータがありません",
  isEmpty: (args) => args.data.length === 0,
  Component: Chart,
});

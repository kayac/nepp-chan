import type { ToolPartComponent } from "~/components/chat/types";

import { DisplayChartToolComponent } from "./ChartToolUI";
import { DisplayTableToolComponent } from "./DataTableToolUI";
import { DisplayTimelineToolComponent } from "./TimelineToolUI";

/** ToolPart の tools.by_name で使用する toolName → 表示コンポーネントのマッピング */
export const toolsByName: Record<string, ToolPartComponent> = {
  displayChartTool: DisplayChartToolComponent,
  displayTableTool: DisplayTableToolComponent,
  displayTimelineTool: DisplayTimelineToolComponent,
};

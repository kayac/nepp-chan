import { DISPLAY_TOOL_NAMES } from "@nepp-chan/shared/constants/display-tools";

import type { ToolPartComponent } from "~/components/chat/types";

import { DisplayChartToolComponent } from "./ChartToolUI";
import { DisplayTableToolComponent } from "./DataTableToolUI";
import { DisplayTimelineToolComponent } from "./TimelineToolUI";

/** toolName → 表示コンポーネントのマッピング */
export const toolsByName: Record<string, ToolPartComponent> = {
  [DISPLAY_TOOL_NAMES.chart]: DisplayChartToolComponent,
  [DISPLAY_TOOL_NAMES.table]: DisplayTableToolComponent,
  [DISPLAY_TOOL_NAMES.timeline]: DisplayTimelineToolComponent,
};

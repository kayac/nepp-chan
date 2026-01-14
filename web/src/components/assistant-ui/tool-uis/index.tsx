import type { ToolCallMessagePartComponent } from "@assistant-ui/react";

import { ChartToolUI, DisplayChartToolComponent } from "./ChartToolUI";
import { ChoiceButtonsToolUI } from "./ChoiceButtonsToolUI";
import { DataTableToolUI, DisplayTableToolComponent } from "./DataTableToolUI";
import { DisplayTimelineToolComponent, TimelineToolUI } from "./TimelineToolUI";

export {
  ChartToolUI,
  ChoiceButtonsToolUI,
  DataTableToolUI,
  DisplayChartToolComponent,
  DisplayTableToolComponent,
  DisplayTimelineToolComponent,
  TimelineToolUI,
};

/**
 * MessagePrimitive.Parts の tools.by_name で使用するマッピング
 */
export const toolsByName: Record<string, ToolCallMessagePartComponent> = {
  displayChartTool: DisplayChartToolComponent,
  displayTableTool: DisplayTableToolComponent,
  displayTimelineTool: DisplayTimelineToolComponent,
};

/**
 * すべての Tool UI コンポーネントを一括で登録するコンポーネント
 * AssistantRuntimeProvider 内に配置して使用
 */
export const ToolUIRegistry = () => (
  <>
    <ChoiceButtonsToolUI />
    <DataTableToolUI />
    <TimelineToolUI />
    <ChartToolUI />
  </>
);

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import type { FC } from "react";

import { ChartToolUI, DisplayChartToolComponent } from "./ChartToolUI";
import { ChoiceButtonsToolUI } from "./ChoiceButtonsToolUI";
import { DataTableToolUI, DisplayTableToolComponent } from "./DataTableToolUI";
import { GoogleSearchToolUI } from "./GoogleSearchToolUI";
import { KnowledgeSearchToolUI } from "./KnowledgeSearchToolUI";
import { DisplayTimelineToolComponent, TimelineToolUI } from "./TimelineToolUI";
import { WeatherToolUI } from "./WeatherToolUI";

export {
  ChartToolUI,
  ChoiceButtonsToolUI,
  DataTableToolUI,
  DisplayChartToolComponent,
  DisplayTableToolComponent,
  DisplayTimelineToolComponent,
  GoogleSearchToolUI,
  KnowledgeSearchToolUI,
  TimelineToolUI,
  WeatherToolUI,
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
export const ToolUIRegistry: FC = () => (
  <>
    <WeatherToolUI />
    <KnowledgeSearchToolUI />
    <GoogleSearchToolUI />
    <ChoiceButtonsToolUI />
    <DataTableToolUI />
    <TimelineToolUI />
    <ChartToolUI />
  </>
);

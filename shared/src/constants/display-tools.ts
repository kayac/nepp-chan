/**
 * display 系ツールの toolName。
 * server が agent に登録する toolName と web の toolsByName のキーを
 * この定数で一致させる契約。
 */
export const DISPLAY_TOOL_NAMES = {
  chart: "displayChartTool",
  table: "displayTableTool",
  timeline: "displayTimelineTool",
} as const;

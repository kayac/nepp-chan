/**
 * display 系ツールの toolName。
 * agent の tools オブジェクトのキー（= AI SDK の toolName）と
 * フロントの toolsByName のキーをこの定数で揃える。
 * （createTool の id とは別物）
 */
export const DISPLAY_TOOL_NAMES = {
  chart: "displayChartTool",
  table: "displayTableTool",
  timeline: "displayTimelineTool",
} as const;

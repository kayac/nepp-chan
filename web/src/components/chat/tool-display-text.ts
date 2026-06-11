import { AGENT_TOOL_NAMES } from "@nepp-chan/shared/constants/agent-tools";

/** Mastra の Memory 機能が内部で登録する working memory 更新ツールの toolName */
const MASTRA_MEMORY_TOOL_NAME = "updateWorkingMemory";

const REPORT_TEXT = {
  running: "ねっぷちゃんが報告中",
  completed: "ねっぷちゃんが報告しました",
};
const MEMORY_TEXT = {
  running: "ねっぷちゃんが記憶中",
  completed: "ねっぷちゃんが記憶しました",
};
const DEFAULT_TEXT = {
  running: "ねっぷちゃんが調査中",
  completed: "ねっぷちゃんが調査しました",
};

const TEXT_BY_TOOL: Record<string, typeof DEFAULT_TEXT> = {
  [AGENT_TOOL_NAMES.emergencyReport]: REPORT_TEXT,
  [AGENT_TOOL_NAMES.emergencyUpdate]: REPORT_TEXT,
  [MASTRA_MEMORY_TOOL_NAME]: MEMORY_TEXT,
};

export const getToolDisplayName = (toolName: string, isRunning: boolean) => {
  const text = TEXT_BY_TOOL[toolName] ?? DEFAULT_TEXT;
  return isRunning ? text.running : text.completed;
};

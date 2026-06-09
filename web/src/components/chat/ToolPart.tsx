import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { getToolOrDynamicToolName } from "ai";

import { ToolFallback } from "~/components/chat/ToolFallback";
import { toolsByName } from "~/components/chat/tool-uis";
import type { ToolPartStatus } from "~/components/chat/types";

type AnyToolPart = ToolUIPart | DynamicToolUIPart;

export const mapToolStateToStatus = (
  state: AnyToolPart["state"],
  errorText?: string,
): ToolPartStatus => {
  switch (state) {
    case "output-available":
      return { type: "complete" };
    case "output-error":
      return { type: "incomplete", reason: "error", error: errorText };
    default:
      return { type: "running" };
  }
};

export const ToolPart = ({ part }: { part: AnyToolPart }) => {
  const toolName = getToolOrDynamicToolName(part);
  const status = mapToolStateToStatus(part.state, part.errorText);
  const result = part.state === "output-available" ? part.output : undefined;
  const args = part.input ?? {};

  const Component = toolsByName[toolName] ?? ToolFallback;

  return (
    <Component
      toolName={toolName}
      args={args}
      result={result}
      status={status}
    />
  );
};

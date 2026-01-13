import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/class-merge";

const REPORT_TOOLS = ["emergencyReportTool", "emergencyUpdateTool"];

const getToolDisplayName = (toolName: string) => {
  if (REPORT_TOOLS.includes(toolName)) return "ねっぷちゃんが報告中";
  return "ねっぷちゃんが調査中";
};

const getToolStatus = (
  status: { type: string; reason?: string } | undefined,
): { label: string; color: string; icon: string } => {
  if (!status) {
    return { label: "実行中", color: "text-yellow-600", icon: "⏳" };
  }
  switch (status.type) {
    case "running":
      return { label: "実行中", color: "text-yellow-600", icon: "⏳" };
    case "complete":
      return { label: "完了", color: "text-green-600", icon: "✅" };
    case "incomplete":
      if (status.reason === "cancelled") {
        return { label: "キャンセル", color: "text-gray-500", icon: "⏹️" };
      }
      if (status.reason === "error") {
        return { label: "エラー", color: "text-red-600", icon: "❌" };
      }
      return { label: "未完了", color: "text-gray-500", icon: "⚠️" };
    default:
      return { label: "不明", color: "text-(--color-text-muted)", icon: "" };
  }
};

export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  args,
  result,
  status,
}) => {
  console.log("[ToolFallback] render called", { toolName, args, status });
  const [isCollapsed, setIsCollapsed] = useState(true);

  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  const isError = status?.type === "incomplete" && status.reason === "error";
  const cancelledReason =
    (isCancelled || isError) && status.error
      ? typeof status.error === "string"
        ? status.error
        : JSON.stringify(status.error)
      : null;

  const displayName = getToolDisplayName(toolName);
  const toolStatus = getToolStatus(status);

  return (
    <div
      className={cn(
        "aui-tool-fallback-root mb-4 flex w-full flex-col gap-3 rounded-lg border py-3",
        isCancelled && "border-gray-300 bg-gray-50",
      )}
    >
      <div className="aui-tool-fallback-header flex items-center gap-2 px-4">
        <span>{toolStatus.icon}</span>
        <p
          className={cn(
            "aui-tool-fallback-title grow",
            isCancelled && "text-(--color-text-muted) line-through",
          )}
        >
          {displayName}
        </p>
        <span className={cn("text-sm", toolStatus.color)}>
          {toolStatus.label}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </Button>
      </div>
      {!isCollapsed && (
        <div className="aui-tool-fallback-content flex flex-col gap-2 border-t pt-2">
          {cancelledReason && (
            <div className="aui-tool-fallback-cancelled-root px-4">
              <p className="aui-tool-fallback-cancelled-header font-semibold text-(--color-text-muted)">
                {isError ? "エラー詳細:" : "キャンセル理由:"}
              </p>
              <p className="aui-tool-fallback-cancelled-reason text-(--color-text-muted)">
                {cancelledReason}
              </p>
            </div>
          )}
          <div
            className={cn(
              "aui-tool-fallback-args-root px-4",
              isCancelled && "opacity-60",
            )}
          >
            <p className="font-semibold text-(--color-text-muted) text-xs mb-1">
              📥 入力パラメータ
            </p>
            <pre className="aui-tool-fallback-args-value whitespace-pre-wrap text-xs bg-(--color-surface) p-2 rounded">
              {argsText}
            </pre>
          </div>
          {!isCancelled && result !== undefined && (
            <div className="aui-tool-fallback-result-root border-t border-dashed px-4 pt-2">
              <p className="aui-tool-fallback-result-header font-semibold text-(--color-text-muted) text-xs mb-1">
                📤 実行結果
              </p>
              <pre className="aui-tool-fallback-result-content whitespace-pre-wrap text-xs bg-(--color-surface) p-2 rounded">
                {typeof result === "string"
                  ? result
                  : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

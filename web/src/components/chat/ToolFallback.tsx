import { cn } from "@nepp-chan/shared/lib/class-merge";
import { Spinner } from "@nepp-chan/shared/ui/Loading";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
} from "lucide-react";
import type { FC, ReactNode } from "react";
import { useState } from "react";

import type {
  ToolPartComponent,
  ToolPartStatus,
} from "~/components/chat/types";

const REPORT_TOOLS = ["emergencyReportTool", "emergencyUpdateTool"];
const MEMORY_TOOLS = ["updateWorkingMemory"];

type ToolDisplayText = {
  running: string;
  completed: string;
};

const TOOL_DISPLAY_MAP: Record<string, ToolDisplayText> = {
  report: {
    running: "ねっぷちゃんが報告中",
    completed: "ねっぷちゃんが報告しました",
  },
  memory: {
    running: "ねっぷちゃんが記憶中",
    completed: "ねっぷちゃんが記憶しました",
  },
  default: {
    running: "ねっぷちゃんが調査中",
    completed: "ねっぷちゃんが調査しました",
  },
};

const getToolDisplayName = (toolName: string, isRunning: boolean) => {
  const getCategory = () => {
    if (REPORT_TOOLS.includes(toolName)) return "report";
    if (MEMORY_TOOLS.includes(toolName)) return "memory";
    return "default";
  };

  const display = TOOL_DISPLAY_MAP[getCategory()];
  return isRunning ? display.running : display.completed;
};

type ToolStatusInfo = {
  label: string;
  color: string;
  bgColor: string;
  icon: ReactNode;
};

const getToolStatus = (status: ToolPartStatus): ToolStatusInfo => {
  if (status.type === "running") {
    return {
      label: "実行中",
      color: "text-(--warning)",
      bgColor: "bg-(--warning-bg)",
      icon: <Spinner size="sm" />,
    };
  }
  if (status.type === "complete") {
    return {
      label: "完了",
      color: "text-(--success)",
      bgColor: "bg-(--success-bg)",
      icon: <CheckCircle2Icon className="size-3" />,
    };
  }
  return {
    label: "エラー",
    color: "text-(--danger)",
    bgColor: "bg-(--danger-bg)",
    icon: <AlertCircleIcon className="size-3" />,
  };
};

type StatusBadgeProps = {
  status: ToolStatusInfo;
};

const StatusBadge: FC<StatusBadgeProps> = ({ status }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium transition-colors",
      status.color,
      status.bgColor,
    )}
  >
    {status.icon}
    <span className="hidden sm:inline">{status.label}</span>
  </span>
);

export const ToolFallback: ToolPartComponent = ({
  toolName,
  args,
  result,
  status,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const isError = status.type === "incomplete";
  const isRunning = status.type === "running";
  const errorReason =
    isError && status.error
      ? typeof status.error === "string"
        ? status.error
        : JSON.stringify(status.error)
      : null;

  const displayName = getToolDisplayName(toolName, isRunning);
  const toolStatus = getToolStatus(status);

  return (
    <div
      className={cn(
        "aui-tool-fallback-root my-1 flex w-full flex-col rounded-lg border transition-colors",
        isError && "border-(--apricot-300) bg-(--apricot-50)/60",
        isRunning && "border-(--brand-soft) bg-(--brand-soft)/30",
        !isError && !isRunning && "border-(--border-1) bg-(--bg-raised)",
      )}
    >
      <div className="aui-tool-fallback-header flex items-center gap-1.5 px-2.5 py-1.5">
        <SearchIcon
          className={cn(
            "size-3 shrink-0",
            isRunning ? "text-(--brand) animate-pulse-subtle" : "text-(--fg-3)",
          )}
        />

        <p className="flex-1 min-w-0 text-xs truncate text-(--fg-2)">
          {displayName}
        </p>

        <StatusBadge status={toolStatus} />

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="shrink-0 p-0.5 text-(--fg-3) hover:text-(--fg-2) transition-colors"
          aria-label={isCollapsed ? "詳細を表示" : "詳細を隠す"}
        >
          {isCollapsed ? (
            <ChevronDownIcon className="size-3" />
          ) : (
            <ChevronUpIcon className="size-3" />
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="aui-tool-fallback-content flex flex-col gap-2 border-t border-(--border-1) px-3 py-2">
          {errorReason && (
            <div className="aui-tool-fallback-error-root">
              <p className="text-xs font-medium text-(--fg-3) mb-1.5">
                エラー詳細
              </p>
              <p className="text-sm p-2.5 rounded-lg bg-(--danger-bg) text-(--danger)">
                {errorReason}
              </p>
            </div>
          )}

          <div className="aui-tool-fallback-args-root">
            <p className="text-xs font-medium text-(--fg-3) mb-1.5">
              入力パラメータ
            </p>
            <pre className="aui-tool-fallback-args-value whitespace-pre-wrap text-xs bg-(--bg-sunken) text-(--fg-2) p-2.5 rounded-lg overflow-auto max-h-40">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>

          {result !== undefined && (
            <div className="aui-tool-fallback-result-root">
              <p className="text-xs font-medium text-(--fg-3) mb-1.5">
                実行結果
              </p>
              <pre className="aui-tool-fallback-result-content whitespace-pre-wrap text-xs bg-(--success-bg) text-(--fg-2) p-2.5 rounded-lg overflow-auto max-h-60">
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

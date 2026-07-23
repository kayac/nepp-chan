import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { Spinner } from "@nepp-chan/shared/ui/Loading";
import type { FC, ReactNode } from "react";
import { useState } from "react";

import { getToolDisplayName } from "~/components/chat/tool-display-text";
import type {
  ToolPartComponent,
  ToolPartStatus,
} from "~/components/chat/types";
import { ErrorBanner } from "~/components/ui/ErrorBanner";

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
      icon: <CheckCircleIcon className="size-3" />,
    };
  }
  return {
    label: "エラー",
    color: "text-(--danger)",
    bgColor: "bg-(--danger-bg)",
    icon: <ExclamationCircleIcon className="size-3" />,
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
        <MagnifyingGlassIcon
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
              <ErrorBanner className="p-2.5">{errorReason}</ErrorBanner>
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

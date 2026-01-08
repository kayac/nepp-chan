import type { UIMessage } from "ai";
import { isToolOrDynamicToolUIPart } from "ai";
import { useState } from "react";

import type { FeedbackRating } from "~/types";

import { FeedbackButton } from "./FeedbackButton";

type Props = {
  message: UIMessage;
  isStreaming?: boolean;
  onFeedbackClick?: (rating: FeedbackRating) => void;
  submittedRating?: FeedbackRating | null;
};

const getMessageContent = (message: UIMessage): string => {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
};

const getToolDisplayName = (toolName: string): string => {
  const names: Record<string, string> = {
    "agent-webResearcherAgent": "🔍 ウェブ検索",
    updateWorkingMemory: "💾 記憶を更新",
    emergencyReportTool: "🚨 緊急報告",
    emergencyUpdateTool: "📝 緊急情報更新",
  };
  return names[toolName] || `🔧 ${toolName}`;
};

const getToolStatus = (
  state: string,
): { label: string; color: string; icon: string } => {
  switch (state) {
    case "input-streaming":
    case "input-available":
      return { label: "実行中", color: "text-yellow-600", icon: "⏳" };
    case "output-available":
      return { label: "完了", color: "text-green-600", icon: "✅" };
    case "output-error":
      return { label: "エラー", color: "text-red-600", icon: "❌" };
    default:
      return {
        label: state,
        color: "text-[var(--color-text-muted)]",
        icon: "",
      };
  }
};

const getToolNameFromPart = (part: {
  type: string;
  toolName?: string;
}): string => {
  if ("toolName" in part && part.toolName) return part.toolName;
  const match = part.type.match(/^tool-(.+)$/);
  return match ? match[1] : part.type;
};

const getStreamingStatus = (
  message: UIMessage,
  isStreaming: boolean,
): { label: string; icon: string } | null => {
  if (!isStreaming) return null;
  const toolParts = message.parts.filter(isToolOrDynamicToolUIPart);
  const currentTool = toolParts.find(
    (t) => t.state === "input-streaming" || t.state === "input-available",
  );
  if (currentTool) {
    return {
      label: getToolDisplayName(getToolNameFromPart(currentTool)),
      icon: "⚙️",
    };
  }
  if (getMessageContent(message)) return null;
  return { label: "考え中...", icon: "🤔" };
};

export const MessageItem = ({
  message,
  isStreaming = false,
  onFeedbackClick,
  submittedRating,
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isUser = message.role === "user";
  const content = getMessageContent(message);
  const toolParts = message.parts.filter(isToolOrDynamicToolUIPart);
  const hasDebugInfo = toolParts.length > 0;
  const streamingStatus = getStreamingStatus(message, isStreaming);

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] bg-[var(--color-accent)] text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
          <div className="whitespace-pre-wrap break-words text-sm">
            {content}
          </div>
        </div>
      </div>
    );
  }

  if (isStreaming && !content) {
    return (
      <div className="animate-fade-in">
        <div className="text-xs text-[var(--color-text-muted)] mb-1.5 flex items-center gap-1">
          <span>ねっぷちゃん</span>
        </div>
        <div className="inline-block bg-[var(--color-surface)] rounded-2xl rounded-tl-sm px-4 py-2.5">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <span>{streamingStatus?.icon || "🤔"}</span>
            <span className="animate-pulse">
              {streamingStatus?.label || "考え中..."}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="text-xs text-[var(--color-text-muted)] mb-1.5 flex items-center gap-1">
        <span>ねっぷちゃん</span>
      </div>
      <div className="inline-block max-w-[85%] bg-[var(--color-surface)] rounded-2xl rounded-tl-sm px-4 py-2.5">
        <div className="whitespace-pre-wrap break-words text-sm">{content}</div>
        {isStreaming && streamingStatus && (
          <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span>{streamingStatus.icon}</span>
            <span className="animate-pulse">{streamingStatus.label}</span>
          </div>
        )}
      </div>

      {!isStreaming && content && (
        <div className="mt-2">
          <div className="flex items-center gap-3">
            {onFeedbackClick && (
              <FeedbackButton
                onFeedback={onFeedbackClick}
                submittedRating={submittedRating}
              />
            )}
            {hasDebugInfo && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1"
              >
                <span
                  className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                >
                  ▶
                </span>
                🔧 実行詳細 ({toolParts.length} ツール)
              </button>
            )}
          </div>
          {hasDebugInfo && isExpanded && (
            <div className="mt-2 bg-[var(--color-surface)] rounded-lg p-3 text-xs space-y-2">
              {toolParts.map((part, index) => {
                const toolName = getToolNameFromPart(part);
                const status = getToolStatus(part.state);
                const input = "input" in part ? part.input : undefined;
                const output = "output" in part ? part.output : undefined;
                const errorText =
                  "errorText" in part ? part.errorText : undefined;

                return (
                  <div
                    key={`${part.toolCallId}-${index}`}
                    className="border-b border-[var(--color-border)] pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {getToolDisplayName(toolName)}
                      </span>
                      <span
                        className={`${status.color} flex items-center gap-1`}
                      >
                        <span>{status.icon}</span>
                        <span>{status.label}</span>
                      </span>
                    </div>
                    {input !== undefined && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                          📥 入力パラメータ
                        </summary>
                        <pre className="mt-1 p-2 bg-white rounded text-[10px] overflow-x-auto">
                          {JSON.stringify(input, null, 2)}
                        </pre>
                      </details>
                    )}
                    {output !== undefined && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                          📤 実行結果
                        </summary>
                        <pre className="mt-1 p-2 bg-white rounded text-[10px] overflow-x-auto">
                          {JSON.stringify(output, null, 2)}
                        </pre>
                      </details>
                    )}
                    {errorText && (
                      <details className="mt-1" open>
                        <summary className="cursor-pointer text-red-500 hover:text-red-700">
                          ❌ エラー詳細
                        </summary>
                        <pre className="mt-1 p-2 bg-red-50 rounded text-[10px] overflow-x-auto text-red-700">
                          {errorText}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import type { UIMessage } from "ai";
import { isToolOrDynamicToolUIPart } from "ai";
import { useState } from "react";

type Props = {
  message: UIMessage;
  isStreaming?: boolean;
};

const getMessageContent = (message: UIMessage): string => {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
};

// ツール名から表示名を取得
const getToolDisplayName = (toolName: string): string => {
  const names: Record<string, string> = {
    "agent-webResearcherAgent": "🔍 ウェブ検索",
    updateWorkingMemory: "💾 記憶を更新",
    emergencyReportTool: "🚨 緊急報告",
    emergencyUpdateTool: "📝 緊急情報更新",
  };
  return names[toolName] || `🔧 ${toolName}`;
};

// ツールの状態から表示用ラベルと色を取得
const getToolStatus = (state: string): { label: string; color: string } => {
  switch (state) {
    case "input-streaming":
    case "input-available":
      return { label: "実行中...", color: "text-yellow-600" };
    case "output-available":
      return { label: "完了", color: "text-green-600" };
    case "output-error":
      return { label: "エラー", color: "text-red-600" };
    default:
      return { label: state, color: "text-gray-600" };
  }
};

// ツールパーツからツール名を取得
const getToolNameFromPart = (part: {
  type: string;
  toolName?: string;
}): string => {
  if ("toolName" in part && part.toolName) {
    return part.toolName;
  }
  // type が "tool-xxx" の場合、xxx がツール名
  const match = part.type.match(/^tool-(.+)$/);
  return match ? match[1] : part.type;
};

// 現在のストリーミング状態を取得
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

  const content = getMessageContent(message);
  if (content) {
    return { label: "返答中...", icon: "💬" };
  }

  return { label: "考え中...", icon: "🤔" };
};

export const MessageItem = ({ message, isStreaming = false }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isUser = message.role === "user";
  const content = getMessageContent(message);

  // ツールパーツを抽出
  const toolParts = message.parts.filter(isToolOrDynamicToolUIPart);
  const hasDebugInfo = toolParts.length > 0;

  // ストリーミング状態
  const streamingStatus = getStreamingStatus(message, isStreaming);

  // ユーザーメッセージ
  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-blue-500 text-white rounded-br-sm">
          <div className="whitespace-pre-wrap break-words">{content}</div>
        </div>
      </div>
    );
  }

  // アシスタントメッセージ（ストリーミング中で内容がない場合）
  if (isStreaming && !content) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[80%]">
          <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2">
            <div className="text-xs text-gray-500 mb-1 font-medium">
              ねっぷちゃん
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <span className="text-lg">{streamingStatus?.icon || "🤔"}</span>
              <span className="animate-pulse">
                {streamingStatus?.label || "考え中..."}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // アシスタントメッセージ（内容あり）
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%]">
        <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2">
          <div className="text-xs text-gray-500 mb-1 font-medium">
            ねっぷちゃん
          </div>
          <div className="whitespace-pre-wrap break-words">{content}</div>

          {/* リアルタイムステータス - ストリーミング中（バブル内に表示） */}
          {isStreaming && streamingStatus && (
            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2 text-sm text-gray-500">
              <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span>{streamingStatus.icon}</span>
              <span className="animate-pulse">{streamingStatus.label}</span>
            </div>
          )}
        </div>

        {/* 実行詳細アコーディオン - ストリーミング完了後（バブル外に表示） */}
        {hasDebugInfo && !isStreaming && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <span
                className={`transform transition-transform ${isExpanded ? "rotate-90" : ""}`}
              >
                ▶
              </span>
              <span>実行詳細 ({toolParts.length} ツール)</span>
            </button>

            {isExpanded && (
              <div className="mt-2 border rounded-lg bg-gray-50 p-3 text-xs space-y-2">
                {toolParts.map((part, index) => {
                  const toolName = getToolNameFromPart(part);
                  const status = getToolStatus(part.state);
                  const hasError = part.state === "output-error";
                  const input = "input" in part ? part.input : undefined;
                  const output = "output" in part ? part.output : undefined;
                  const errorText =
                    "errorText" in part ? part.errorText : undefined;

                  return (
                    <div
                      key={`${part.toolCallId}-${index}`}
                      className="border-b border-gray-200 pb-2 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {getToolDisplayName(toolName)}
                        </span>
                        <span className={status.color}>{status.label}</span>
                      </div>

                      {input !== undefined && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                            入力パラメータ
                          </summary>
                          <pre className="mt-1 p-2 bg-white rounded text-[10px] overflow-x-auto">
                            {JSON.stringify(input, null, 2)}
                          </pre>
                        </details>
                      )}

                      {output !== undefined && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                            実行結果
                          </summary>
                          <pre className="mt-1 p-2 bg-white rounded text-[10px] overflow-x-auto">
                            {JSON.stringify(output, null, 2)}
                          </pre>
                        </details>
                      )}

                      {hasError && errorText && (
                        <details className="mt-1" open>
                          <summary className="cursor-pointer text-red-500 hover:text-red-700">
                            エラー詳細
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
    </div>
  );
};

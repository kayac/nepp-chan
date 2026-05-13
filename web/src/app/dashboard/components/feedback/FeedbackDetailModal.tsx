import {
  HandThumbDownIcon,
  HandThumbUpIcon,
  LightBulbIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

import { formatDateTime } from "~/lib/format";
import { FEEDBACK_CATEGORY_LABELS, type MessageFeedback } from "~/types";

type Props = {
  feedback: MessageFeedback;
  onClose: () => void;
};

export const FeedbackDetailModal = ({ feedback, onClose }: Props) => {
  const conversationContext = feedback.conversationContext;
  const toolExecutions = feedback.toolExecutions
    ? feedback.toolExecutions.map((tool, i) => ({
        ...tool,
        id: `${tool.toolName}-${i}`,
      }))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 cursor-default"
        onClick={onClose}
        aria-label="閉じる"
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 p-6 max-h-[90dvh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-stone-800">
            フィードバック詳細
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600 rounded-md"
            aria-label="閉じる"
          >
            <XMarkIcon className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                feedback.rating === "good"
                  ? "bg-green-100 text-green-700"
                  : feedback.rating === "idea"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {feedback.rating === "good" ? (
                <>
                  <HandThumbUpIcon className="w-4 h-4" />
                  良い回答
                </>
              ) : feedback.rating === "idea" ? (
                <>
                  <LightBulbIcon className="w-4 h-4" />
                  アイデア
                </>
              ) : (
                <>
                  <HandThumbDownIcon className="w-4 h-4" />
                  改善が必要
                </>
              )}
            </span>
            {feedback.category && (
              <span className="inline-flex px-2 py-1 text-xs font-medium bg-stone-100 text-stone-600 rounded">
                {FEEDBACK_CATEGORY_LABELS[feedback.category] ||
                  feedback.category}
              </span>
            )}
            <span className="text-sm text-stone-500">
              {formatDateTime(feedback.createdAt)}
            </span>
          </div>

          {feedback.comment && (
            <div>
              <h3 className="text-sm font-medium text-stone-700 mb-2">
                コメント
              </h3>
              <div className="bg-stone-50 rounded-lg p-4 text-sm text-stone-700 whitespace-pre-wrap">
                {feedback.comment}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-stone-700 mb-2">
              会話コンテキスト
            </h3>
            <div className="space-y-2">
              {conversationContext.previousMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-50 text-blue-800 ml-8"
                      : "bg-stone-50 text-stone-700 mr-8"
                  }`}
                >
                  <div className="text-xs font-medium mb-1 opacity-70">
                    {msg.role === "user" ? "ユーザー" : "ねっぷちゃん"}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
              <div
                className={`rounded-lg p-3 text-sm border-2 ${
                  conversationContext.targetMessage.role === "user"
                    ? "bg-blue-50 text-blue-800 ml-8 border-blue-300"
                    : "bg-stone-50 text-stone-700 mr-8 border-red-300"
                }`}
              >
                <div className="text-xs font-medium mb-1 opacity-70">
                  {conversationContext.targetMessage.role === "user"
                    ? "ユーザー"
                    : "ねっぷちゃん"}
                  （対象メッセージ）
                </div>
                <div className="whitespace-pre-wrap">
                  {conversationContext.targetMessage.content}
                </div>
              </div>
              {conversationContext.nextMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-50 text-blue-800 ml-8"
                      : "bg-stone-50 text-stone-700 mr-8"
                  }`}
                >
                  <div className="text-xs font-medium mb-1 opacity-70">
                    {msg.role === "user" ? "ユーザー" : "ねっぷちゃん"}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
            </div>
          </div>

          {toolExecutions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-stone-700 mb-2">
                ツール実行結果
              </h3>
              <div className="space-y-2">
                {toolExecutions.map((tool) => (
                  <div
                    key={tool.id}
                    className="bg-stone-50 rounded-lg p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-stone-700">
                        {tool.toolName}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          tool.state === "result"
                            ? "bg-green-100 text-green-700"
                            : tool.state === "call"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {tool.state}
                      </span>
                    </div>
                    {tool.input !== undefined && (
                      <div className="mb-2">
                        <div className="text-xs text-stone-500 mb-1">入力:</div>
                        <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-96">
                          {JSON.stringify(tool.input, null, 2)}
                        </pre>
                      </div>
                    )}
                    {tool.output !== undefined && (
                      <div>
                        <div className="text-xs text-stone-500 mb-1">出力:</div>
                        <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-96">
                          {typeof tool.output === "string"
                            ? tool.output
                            : JSON.stringify(tool.output, null, 2)}
                        </pre>
                      </div>
                    )}
                    {tool.errorText && (
                      <div>
                        <div className="text-xs text-red-500 mb-1">エラー:</div>
                        <pre className="text-xs bg-red-50 text-red-700 p-2 rounded">
                          {tool.errorText}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

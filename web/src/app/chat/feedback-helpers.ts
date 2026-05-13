import type { UIMessage } from "ai";
import { isToolOrDynamicToolUIPart } from "ai";

import type { ConversationContext, ToolExecution } from "~/types";

export const getMessageContent = (message: UIMessage) =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

export const getToolNameFromPart = (part: {
  type: string;
  toolName?: string;
}) => {
  if ("toolName" in part && part.toolName) return part.toolName;
  const match = part.type.match(/^tool-(.+)$/);
  return match ? match[1] : part.type;
};

export const extractConversationContext = (
  messages: UIMessage[],
  targetMessageId: string,
): ConversationContext | null => {
  const targetIndex = messages.findIndex((m) => m.id === targetMessageId);
  if (targetIndex === -1) return null;

  const targetMessage = messages[targetIndex];
  const previousMessage =
    targetIndex > 0 ? messages[targetIndex - 1] : undefined;

  return {
    targetMessage: {
      id: targetMessage.id,
      role: targetMessage.role,
      content: getMessageContent(targetMessage),
    },
    previousMessages: previousMessage
      ? [
          {
            id: previousMessage.id,
            role: previousMessage.role,
            content: getMessageContent(previousMessage),
          },
        ]
      : [],
    nextMessages: [],
  };
};

export const extractToolExecutions = (message: UIMessage): ToolExecution[] =>
  message.parts.filter(isToolOrDynamicToolUIPart).map((part) => ({
    toolName: getToolNameFromPart(part),
    state: part.state ?? "unknown",
    input: "input" in part ? part.input : undefined,
    output: "output" in part ? part.output : undefined,
    errorText: "errorText" in part ? (part.errorText as string) : undefined,
  }));

/**
 * assistant-ui の ThreadMessage を UIMessage に変換する。
 * tool-call 以外の不明な part は安全側で text にフォールバックする。
 */
export const convertToUIMessages = (
  threadMessages: readonly {
    id: string;
    role: string;
    content: readonly unknown[];
  }[],
): UIMessage[] =>
  threadMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: m.content.map((c) => {
        if (typeof c === "object" && c !== null && "type" in c) {
          const content = c as {
            type: string;
            text?: string;
            [key: string]: unknown;
          };
          if (content.type === "text") {
            return { type: "text" as const, text: content.text ?? "" };
          }
          if (content.type === "tool-call") {
            return c as UIMessage["parts"][number];
          }
        }
        return { type: "text" as const, text: String(c) };
      }),
    }));

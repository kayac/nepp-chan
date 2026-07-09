import { messageText } from "@nepp-chan/shared/lib/message-text";
import type { UIMessage } from "ai";
import { isToolOrDynamicToolUIPart } from "ai";

import type { ConversationContext, ToolExecution } from "~/types";

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
      content: messageText(targetMessage),
    },
    previousMessages: previousMessage
      ? [
          {
            id: previousMessage.id,
            role: previousMessage.role,
            content: messageText(previousMessage),
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

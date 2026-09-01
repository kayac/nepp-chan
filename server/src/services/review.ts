import { convertMessages } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { logger } from "~/lib/logger";
import { voiceTurnMessageId } from "~/lib/principal";
import { getStorage } from "~/lib/storage";

const textOf = (parts: Array<{ type: string }>) =>
  parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("\n");

export const resolveAnswerMessageId = (params: {
  threadId: string | null;
  messageId: string | null;
  turnIndex: number | null;
}) => {
  if (params.messageId) return params.messageId;
  if (
    params.threadId?.startsWith("voice-thread:") &&
    params.turnIndex !== null
  ) {
    return voiceTurnMessageId(params.threadId, params.turnIndex, "assistant");
  }
  return null;
};

export const getAnswerConversation = async (
  d1: D1Database,
  params: {
    threadId: string | null;
    messageId: string | null;
    turnIndex: number | null;
  },
) => {
  const messageId = resolveAnswerMessageId(params);
  if (!params.threadId || !messageId) return null;

  try {
    const storage = await getStorage(d1);
    const memory = new Memory({ storage });
    const result = await memory.recall({
      threadId: params.threadId,
      perPage: false,
      orderBy: { field: "createdAt", direction: "ASC" },
    });
    const uiMessages = convertMessages(result.messages).to("AIV5.UI");
    const index = uiMessages.findIndex((message) => message.id === messageId);
    if (index === -1) return null;

    const question = uiMessages
      .slice(0, index)
      .reverse()
      .find((message) => message.role === "user");

    return {
      question: question ? textOf(question.parts) : null,
      answer: textOf(uiMessages[index].parts),
    };
  } catch (error) {
    logger.warn("[Review] failed to load conversation", {
      threadId: params.threadId,
      error: String(error),
    });
    return null;
  }
};

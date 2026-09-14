import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";

type HandleChatStreamArgs = Parameters<typeof handleChatStream>[0];
type ChatStreamParams = HandleChatStreamArgs["params"];

type RespondWithChatStreamArgs = {
  mastra: HandleChatStreamArgs["mastra"];
  agentId: string;
  messages: unknown[];
  requestContext: ChatStreamParams["requestContext"];
  memory?: ChatStreamParams["memory"];
  onFinish?: ChatStreamParams["onFinish"];
};

/**
 * @mastra/ai-sdk が vendor する UIMessage 宣言はアプリの ai と一致せず、zod
 * スキーマ（looseObject）由来の message はどちらにも構造一致しないため、
 * handleChatStream のシグネチャ由来の型へキャストして渡す。
 */
export const respondWithChatStream = async ({
  mastra,
  agentId,
  messages,
  requestContext,
  memory,
  onFinish,
}: RespondWithChatStreamArgs) => {
  const stream = await handleChatStream({
    mastra,
    agentId,
    version: "v7",
    params: {
      messages: messages as ChatStreamParams["messages"],
      requestContext,
      memory,
      onFinish,
    },
  });

  return createUIMessageStreamResponse({ stream });
};

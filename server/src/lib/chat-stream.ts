import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse, type UIMessage } from "ai";

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
      messages: messages as UIMessage[],
      requestContext,
      memory,
      onFinish,
    },
  });

  return createUIMessageStreamResponse({ stream });
};

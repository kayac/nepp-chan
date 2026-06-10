import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";

type HandleChatStreamArgs = Parameters<typeof handleChatStream>[0];
type ChatStreamParams = HandleChatStreamArgs["params"];
type ChatStreamResponseInit = Parameters<
  typeof createUIMessageStreamResponse
>[0];

type RespondWithChatStreamArgs = {
  mastra: HandleChatStreamArgs["mastra"];
  agentId: string;
  message: unknown;
  requestContext: ChatStreamParams["requestContext"];
  memory?: ChatStreamParams["memory"];
  onFinish?: ChatStreamParams["onFinish"];
};

/**
 * handleChatStream を AI SDK v6 で実行し、UI message stream の Response を返す。
 *
 * @mastra/core は #422(#14503) の Cloudflare Workers 制約で 1.10 系に固定しており、
 * @mastra/ai-sdk が vendor する ai v6 型とアプリの ai@6 型にスナップショット差がある。
 * messages / stream の境界を関数シグネチャ由来の型へキャストして吸収する
 * （実体は同一の v6 UIMessage / SSE ストリーム）。
 */
export const respondWithChatStream = async ({
  mastra,
  agentId,
  message,
  requestContext,
  memory,
  onFinish,
}: RespondWithChatStreamArgs) => {
  const stream = await handleChatStream({
    mastra,
    agentId,
    version: "v6",
    params: {
      messages: [message] as ChatStreamParams["messages"],
      requestContext,
      memory,
      onFinish,
    },
  });

  return createUIMessageStreamResponse({
    stream: stream as ChatStreamResponseInit["stream"],
  });
};

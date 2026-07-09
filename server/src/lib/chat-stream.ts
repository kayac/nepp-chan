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
 * handleChatStream を AI SDK v6 で実行し、UI message stream の Response を返す。
 *
 * @mastra/ai-sdk は ai v6 型のスナップショットを vendor しておりアプリの ai@6 と
 * 宣言が一部異なるうえ、zod スキーマ（looseObject）由来の message はどちらの
 * UIMessage 宣言にも構造一致しないため、handleChatStream のシグネチャ由来の型へ
 * キャストして渡す（値は v6 UIMessage 形式の JSON）。
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
    version: "v6",
    params: {
      messages: messages as ChatStreamParams["messages"],
      requestContext,
      memory,
      onFinish,
    },
  });

  return createUIMessageStreamResponse({ stream });
};

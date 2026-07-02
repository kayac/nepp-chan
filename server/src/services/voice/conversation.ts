import { Mastra } from "@mastra/core/mastra";
import { voiceModelConfig } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { toVoiceIds } from "~/lib/principal";
import { getStorage } from "~/lib/storage";
import { sanitizeForSpeech } from "~/lib/voice-text";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";
import type { VoiceFindingsSlot } from "./findings-slot";

type RunTurnParams = {
  text: string;
  signal?: AbortSignal;
  onToolCall?: () => void;
  findingsSlot?: VoiceFindingsSlot;
};

// 通話（DO インスタンス）ごとに1回だけ生成する。agent/Mastra 構築と
// toVoiceIds の HMAC はターンごとに変わらないため、通話中は使い回す。
export const createVoiceTurnRunner = async ({
  env,
  from,
}: {
  env: CloudflareBindings;
  from: string;
}) => {
  const { resourceId, threadId } = await toVoiceIds(
    from,
    env.RESOURCE_ID_HASH_SECRET,
  );
  const storage = await getStorage(env.DB);
  const neppChanAgent = createNeppChanAgent({
    platform: "voice",
    modelConfig: voiceModelConfig,
  });
  const mastra = new Mastra({ agents: { neppChanAgent }, storage });
  const agent = mastra.getAgent("neppChanAgent");

  return async function* runTurn({
    text,
    signal,
    onToolCall,
    findingsSlot,
  }: RunTurnParams) {
    const start = Date.now();
    const requestContext = createRequestContext({
      storage,
      db: env.DB,
      env,
      voiceFindings: findingsSlot,
      voiceSearchStart: onToolCall,
      voiceTurnSignal: signal,
    });

    const result = await agent.stream(text, {
      requestContext,
      memory: { resource: resourceId, thread: threadId },
      abortSignal: signal,
    });
    const streamReadyMs = Date.now() - start;

    let firstTokenMs: number | null = null;
    try {
      for await (const chunk of result.fullStream) {
        if (signal?.aborted) return;
        if (chunk.type === "tool-call") {
          logger.info("[Voice] tool event", {
            atMs: Date.now() - start,
            type: chunk.type,
            tool: chunk.payload.toolName,
          });
          continue;
        }
        if (chunk.type === "tool-result") {
          logger.info("[Voice] tool event", {
            atMs: Date.now() - start,
            type: chunk.type,
          });
          continue;
        }
        if (chunk.type !== "text-delta") continue;
        if (firstTokenMs === null) firstTokenMs = Date.now() - start;
        const clean = sanitizeForSpeech(chunk.payload.text);
        if (clean) yield clean;
      }
    } finally {
      const timing: Record<string, number> = { streamReadyMs };
      if (firstTokenMs !== null) timing.firstTokenMs = firstTokenMs;
      logger.info("[Voice] llm timing", timing);
    }
  };
};

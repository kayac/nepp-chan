import { Mastra } from "@mastra/core/mastra";
import { voiceModelConfig } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { toVoiceIds } from "~/lib/principal";
import { getStorage } from "~/lib/storage";
import { sanitizeForSpeech } from "~/lib/voice-text";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";
import type { VoiceFindingsSlot } from "./findings-slot";

const SEARCH_TOOL_RE = /knowledge|web|research/i;

export async function* runVoiceTurn({
  env,
  from,
  text,
  signal,
  onToolCall,
  findingsSlot,
}: {
  env: CloudflareBindings;
  from: string;
  text: string;
  signal?: AbortSignal;
  onToolCall?: () => void;
  findingsSlot?: VoiceFindingsSlot;
}) {
  const start = Date.now();
  const { resourceId, threadId } = await toVoiceIds(
    from,
    env.RESOURCE_ID_HASH_SECRET,
  );
  const storage = await getStorage(env.DB);
  const requestContext = createRequestContext({
    storage,
    db: env.DB,
    env,
    voiceFindings: findingsSlot,
    voiceSearchStart: onToolCall,
  });

  const neppChanAgent = createNeppChanAgent({
    platform: "voice",
    modelConfig: voiceModelConfig,
  });
  const mastra = new Mastra({ agents: { neppChanAgent }, storage });
  const agent = mastra.getAgent("neppChanAgent");

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
        const toolName = chunk.payload.toolName;
        logger.info("[Voice] tool event", {
          atMs: Date.now() - start,
          type: chunk.type,
          tool: toolName,
        });
        if (SEARCH_TOOL_RE.test(toolName)) onToolCall?.();
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
}

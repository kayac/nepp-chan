import { Mastra } from "@mastra/core/mastra";
import { classifyIntent } from "~/lib/classify-intent";
import { resolveModelTier } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { toVoiceIds } from "~/lib/principal";
import { getStorage } from "~/lib/storage";
import { sanitizeForSpeech } from "~/lib/voice-text";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";

export async function* streamTextWithAbort(
  textStream: AsyncIterable<string>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  for await (const delta of textStream) {
    if (signal?.aborted) return;
    if (delta) yield delta;
  }
}

export async function* runVoiceTurn({
  env,
  from,
  text,
  signal,
}: {
  env: CloudflareBindings;
  from: string;
  text: string;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const { resourceId, threadId } = await toVoiceIds(
    from,
    env.RESOURCE_ID_HASH_SECRET,
  );
  const storage = await getStorage(env.DB);
  const requestContext = createRequestContext({ storage, db: env.DB, env });

  const intent = text ? await classifyIntent(text) : "casual";
  logger.info("[Voice] intent", { intent });
  const modelConfig = resolveModelTier({
    intent,
    platform: "voice",
    isAdmin: false,
  });

  const neppChanAgent = createNeppChanAgent({ platform: "voice", modelConfig });
  const mastra = new Mastra({ agents: { neppChanAgent }, storage });
  const agent = mastra.getAgent("neppChanAgent");

  const result = await agent.stream(text, {
    requestContext,
    memory: { resource: resourceId, thread: threadId },
    abortSignal: signal,
  });

  for await (const delta of streamTextWithAbort(result.textStream, signal)) {
    const clean = sanitizeForSpeech(delta);
    if (clean) yield clean;
  }
}

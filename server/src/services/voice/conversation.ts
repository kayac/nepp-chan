import { Mastra } from "@mastra/core/mastra";
import type { ModelMessage } from "ai";
import { voiceModelConfig } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { toVoiceIds } from "~/lib/principal";
import { getStorage } from "~/lib/storage";
import { sanitizeForSpeech } from "~/lib/voice-text";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";
import { startVoicePrefetch } from "~/mastra/tools/voice-answer-tool";
import { isQuestionLike } from "./filler";
import type { VoiceFindingsSlot, VoicePrefetchSlot } from "./findings-slot";

type RunTurnParams = {
  text: string;
  signal?: AbortSignal;
  onToolCall?: () => void;
  onEndCall?: () => void;
  findingsSlot?: VoiceFindingsSlot;
  prefetchSlot?: VoicePrefetchSlot;
  parentRouting?: boolean;
};

type PersistTurnParams = {
  turnIndex: number;
  userText: string;
  assistantText: string;
};

const MAX_HISTORY_MESSAGES = 20;
const VOICE_THREAD_TITLE = "音声通話";

const textContent = (text: string) => ({
  format: 2 as const,
  parts: [{ type: "text" as const, text }],
});

// 通話（DO インスタンス）ごとに1回だけ生成し、会話履歴をメモリ上で保持する。
// D1 は応答完了後の persistTurn でのみ触る。
export const createVoiceConversation = async ({
  env,
  from,
  callSid,
}: {
  env: CloudflareBindings;
  from: string;
  callSid: string;
}) => {
  const { resourceId, threadId } = await toVoiceIds(
    from,
    callSid,
    env.RESOURCE_ID_HASH_SECRET,
  );
  const createdAt = new Date();
  let history: ModelMessage[] = [];
  const neppChanAgent = createNeppChanAgent({
    platform: "voice",
    modelConfig: voiceModelConfig,
    withMemory: false,
  });
  const mastra = new Mastra({ agents: { neppChanAgent } });
  const agent = mastra.getAgent("neppChanAgent");

  const runTurn = async function* ({
    text,
    signal,
    onToolCall,
    onEndCall,
    findingsSlot,
    prefetchSlot,
    parentRouting,
  }: RunTurnParams) {
    const start = Date.now();
    const requestContext = createRequestContext({
      db: env.DB,
      env,
      voiceFindings: findingsSlot,
      voicePrefetch: prefetchSlot,
      voiceParentRouting: parentRouting,
      voiceSearchStart: onToolCall,
      voiceTurnSignal: signal,
      voiceEndCall: onEndCall,
    });

    if (prefetchSlot) {
      prefetchSlot.current?.abort();
      prefetchSlot.current = undefined;
      if (isQuestionLike(text)) {
        logger.info("[Voice] prefetch start", { query: text });
        const controller = new AbortController();
        signal?.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
        prefetchSlot.current = {
          query: text,
          abort: () => controller.abort(),
          promise: startVoicePrefetch({
            question: text,
            requestContext,
            signal: controller.signal,
          }),
        };
      }
    }

    const input: ModelMessage[] = [...history, { role: "user", content: text }];

    const result = await agent.stream(input, {
      requestContext,
      abortSignal: signal,
    });
    const streamReadyMs = Date.now() - start;

    let firstTokenMs: number | null = null;
    let assistantText = "";
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
        if (clean) {
          assistantText += clean;
          yield clean;
        }
      }
      if (!signal?.aborted && assistantText) {
        const assistantMessage: ModelMessage = {
          role: "assistant",
          content: assistantText,
        };
        history = [...input, assistantMessage].slice(-MAX_HISTORY_MESSAGES);
      }
    } finally {
      const timing: Record<string, number> = { streamReadyMs };
      if (firstTokenMs !== null) timing.firstTokenMs = firstTokenMs;
      logger.info("[Voice] llm timing", timing);
    }
  };

  const persistTurn = async ({
    turnIndex,
    userText,
    assistantText,
  }: PersistTurnParams) => {
    const storage = await getStorage(env.DB);
    const memoryStore = await storage.getStore("memory");
    if (!memoryStore) throw new Error("Memory storage is unavailable");

    const now = new Date();
    const assistantCreatedAt = new Date(now.getTime() + 1);
    const thread = {
      id: threadId,
      resourceId,
      title: VOICE_THREAD_TITLE,
      createdAt,
      updatedAt: now,
    };
    const messages = [
      {
        id: `${threadId}:turn:${turnIndex}:user`,
        role: "user" as const,
        createdAt: now,
        threadId,
        resourceId,
        content: textContent(userText),
      },
      {
        id: `${threadId}:turn:${turnIndex}:assistant`,
        role: "assistant" as const,
        createdAt: assistantCreatedAt,
        threadId,
        resourceId,
        content: textContent(assistantText),
      },
    ];
    const save = async () => {
      await memoryStore.saveThread({ thread });
      await memoryStore.saveMessages({ messages });
    };

    try {
      await save();
    } catch (error) {
      logger.warn("[Voice] retrying turn persistence", {
        error: error instanceof Error ? error.message : String(error),
        turnIndex,
      });
      await save();
    }
  };

  return { runTurn, persistTurn };
};

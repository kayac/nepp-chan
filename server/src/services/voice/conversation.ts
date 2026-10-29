import { Mastra } from "@mastra/core/mastra";
import type { ModelMessage } from "ai";
import { primaryModelId, voiceModelConfig } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { toVoiceIds } from "~/lib/principal";
import { sanitizeForSpeech } from "~/lib/voice-text";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";
import { startVoicePrefetch } from "~/mastra/tools/voice-answer-tool";
import { newTurnId, recordLlmUsage } from "~/services/analytics/llm-usage";
import { isQuestionLike } from "./filler";
import {
  createVoicePrefetchSlot,
  type VoiceFindingsSlot,
} from "./findings-slot";
import { saveVoiceTurns } from "./persist-turns";

type RunTurnParams = {
  text: string;
  signal?: AbortSignal;
  onToolCall?: () => void;
  onEndCall?: () => void;
  findingsSlot?: VoiceFindingsSlot;
  prefetchEnabled?: boolean;
  parentRouting?: boolean;
};

type PersistTurnParams = {
  turnIndex: number;
  userText: string;
  assistantText: string;
};

const MAX_HISTORY_MESSAGES = 20;

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
    prefetchEnabled,
    parentRouting,
  }: RunTurnParams) {
    const start = Date.now();
    const turnId = newTurnId();
    const prefetchSlot = prefetchEnabled
      ? createVoicePrefetchSlot()
      : undefined;
    const requestContext = createRequestContext({
      db: env.DB,
      env,
      usagePlatform: "voice",
      usageThreadId: threadId,
      usageTurnId: turnId,
      voiceFindings: findingsSlot,
      voicePrefetch: prefetchSlot,
      voiceParentRouting: parentRouting,
      voiceSearchStart: onToolCall,
      voiceTurnSignal: signal,
      voiceEndCall: onEndCall,
    });

    if (prefetchSlot && isQuestionLike(text)) {
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

    const input: ModelMessage[] = [...history, { role: "user", content: text }];

    let streamReadyMs: number | undefined;
    let firstTokenMs: number | null = null;
    let assistantText = "";
    try {
      const result = await agent.stream(input, {
        requestContext,
        abortSignal: signal,
      });
      streamReadyMs = Date.now() - start;

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
      // totalUsage はストリーム完走後にのみ resolve するため、中断ターンでは記録しない
      if (!signal?.aborted) {
        const [totalUsage, response] = await Promise.all([
          result.totalUsage,
          result.response,
        ]);
        await recordLlmUsage(env.DB, {
          model: response?.modelId ?? primaryModelId(voiceModelConfig),
          usage: totalUsage,
          platform: "voice",
          source: "chat",
          agent: "nepp-chan",
          threadId,
          turnId,
          durationMs: Date.now() - start,
        });
      }
    } finally {
      prefetchSlot?.current?.abort();
      if (streamReadyMs !== undefined) {
        const timing: Record<string, number> = { streamReadyMs };
        if (firstTokenMs !== null) timing.firstTokenMs = firstTokenMs;
        logger.info("[Voice] llm timing", timing);
      }
    }
  };

  const recordInterruptedTurn = ({
    userText,
    heardText,
  }: {
    userText: string;
    heardText: string;
  }) => {
    const heard: ModelMessage[] = heardText
      ? [{ role: "assistant", content: heardText }]
      : [];
    history = [
      ...history,
      { role: "user" as const, content: userText },
      ...heard,
    ].slice(-MAX_HISTORY_MESSAGES);
  };

  const truncateLastReply = (heardText: string) => {
    if (history.at(-1)?.role !== "assistant") return;
    const earlier = history.slice(0, -1);
    history = heardText
      ? [...earlier, { role: "assistant", content: heardText }]
      : earlier;
  };

  const persistTurn = (turn: PersistTurnParams) =>
    saveVoiceTurns({
      db: env.DB,
      threadId,
      resourceId,
      createdAt,
      turns: [turn],
    });

  return { runTurn, recordInterruptedTurn, truncateLastReply, persistTurn };
};

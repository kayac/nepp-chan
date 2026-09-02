import type { RequestContext } from "@mastra/core/request-context";
import type { MastraOnFinishCallbackArgs } from "@mastra/core/stream";
import { calcCostUsd, type LlmServiceTier } from "~/lib/llm-pricing";
import { logger } from "~/lib/logger";
import { waitUntilInBackground } from "~/lib/wait-until";
import { getRequestDb } from "~/mastra/request-context";
import { llmUsageRepository } from "~/repository/llm-usage-repository";

export type LlmUsagePlatform = "web" | "line" | "lp" | "widget" | "voice";

export type LlmUsageSource =
  | "chat"
  | "subagent"
  | "intent-classify"
  | "persona-extract"
  | "weekly-report"
  | "image-convert"
  | "embedding"
  | "rerank";

type LlmUsageParams = {
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
    totalTokens?: number;
  };
  platform?: LlmUsagePlatform;
  source: LlmUsageSource;
  agent?: string;
  intent?: "casual" | "thinking";
  threadId?: string;
  turnIndex?: number;
  durationMs?: number;
  serviceTier?: LlmServiceTier;
};

/**
 * LLM 呼び出しのトークン使用量を記録する。
 * 計測は本処理の付随なので、失敗しても throw せずログのみ残す。
 */
// プロバイダが usage を返さない場合に NaN が来る（例: Google embedding）。
// NaN は D1 の insert 自体を失敗させるため 0 に正規化する
const finiteOrZero = (value?: number) =>
  value !== undefined && Number.isFinite(value) ? value : 0;

export const recordLlmUsage = async (
  d1: D1Database,
  params: LlmUsageParams,
) => {
  try {
    const inputTokens = finiteOrZero(params.usage?.inputTokens);
    const outputTokens = finiteOrZero(params.usage?.outputTokens);
    const reasoningTokens = finiteOrZero(params.usage?.reasoningTokens);
    const cachedInputTokens = finiteOrZero(params.usage?.cachedInputTokens);
    await llmUsageRepository.create(d1, {
      id: crypto.randomUUID(),
      model: params.model,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cachedInputTokens,
      // プロバイダが totalTokens を返さない場合は内訳から合算する
      // （outputTokens は reasoning 込みの総数なので reasoning は足さない）
      totalTokens:
        params.usage?.totalTokens !== undefined &&
        Number.isFinite(params.usage.totalTokens)
          ? params.usage.totalTokens
          : inputTokens + outputTokens,
      platform: params.platform,
      source: params.source,
      agent: params.agent,
      intent: params.intent,
      threadId: params.threadId,
      turnIndex: params.turnIndex,
      durationMs: params.durationMs,
      costUsd: calcCostUsd(
        params.model,
        { inputTokens, outputTokens, cachedInputTokens },
        { serviceTier: params.serviceTier },
      ),
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn("[LlmUsage] failed to record usage", { error: String(error) });
  }
};

/**
 * スレッド内の何往復目かを返す（1 始まり）。
 * source='chat' が 1 往復に 1 行なので、その件数 + 1 が今回のターン。
 * 記録失敗時も応答は止めないため、取得できなければ undefined を返す。
 */
export const nextTurnIndex = async (d1: D1Database, threadId: string) => {
  try {
    const chatCalls = await llmUsageRepository.countChatByThread(d1, threadId);
    return chatCalls + 1;
  } catch (error) {
    logger.warn("[LlmUsage] failed to resolve turn index", {
      error: String(error),
    });
    return undefined;
  }
};

const contextAttributes = (requestContext: RequestContext | undefined) => ({
  platform: requestContext?.get("usagePlatform") as
    | LlmUsagePlatform
    | undefined,
  threadId: requestContext?.get("usageThreadId") as string | undefined,
  turnIndex: requestContext?.get("usageTurnIndex") as number | undefined,
});

/** requestContext から db・チャネル・スレッドを取り出して記録する（db 不在なら何もしない） */
export const recordUsageFromContext = (
  requestContext: RequestContext | undefined,
  params: {
    model: string;
    usage?: LlmUsageParams["usage"];
    source: LlmUsageSource;
    agent: string;
    durationMs?: number;
  },
) => {
  const db = getRequestDb(requestContext);
  if (!db) return;
  return recordLlmUsage(db, {
    ...params,
    ...contextAttributes(requestContext),
  });
};

/** defaultOptions を動的関数に置き換えるため、静的オプションは defaults 経由で引き継ぐ */
const serviceTierOf = (defaultOptions?: Record<string, unknown>) =>
  (
    defaultOptions?.providerOptions as
      | { openai?: { serviceTier?: LlmServiceTier } }
      | undefined
  )?.openai?.serviceTier;

export const withUsageRecording = <
  T extends { model: string; defaultOptions?: Record<string, unknown> },
>(
  config: T,
  params: { agent: string; source?: LlmUsageSource },
) => ({
  model: config.model,
  defaultOptions: usageRecordingOptions({
    source: params.source ?? "subagent",
    agent: params.agent,
    serviceTier: serviceTierOf(config.defaultOptions),
    fallbackModel: config.model,
    defaults: config.defaultOptions,
  }),
});

/**
 * 委譲サブエージェントの usage は親の totalUsage に合算されない（Mastra 仕様）ため、
 * 各エージェント自身の onFinish で記録する。db・スレッド等の属性は委譲経由でも
 * 引き継がれる requestContext から取り出す。
 */
export const usageRecordingOptions =
  <T extends Record<string, unknown>>(params: {
    source: LlmUsageSource;
    agent?: string;
    serviceTier?: LlmServiceTier;
    fallbackModel: string;
    defaults?: T;
  }) =>
  ({ requestContext }: { requestContext?: RequestContext }) => {
    const startedAt = Date.now();
    return {
      ...(params.defaults ?? ({} as T)),
      onFinish: (event: MastraOnFinishCallbackArgs) => {
        const db = getRequestDb(requestContext);
        if (!db) return;
        const recording = recordLlmUsage(db, {
          model: event.model?.modelId ?? params.fallbackModel,
          usage: event.totalUsage,
          source: params.source,
          agent: params.agent,
          serviceTier: params.serviceTier,
          durationMs: Date.now() - startedAt,
          ...contextAttributes(requestContext),
        });
        waitUntilInBackground(recording);
        return recording;
      },
    };
  };

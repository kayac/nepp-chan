import { createDb, llmUsage } from "~/db";
import { logger } from "~/lib/logger";

type LlmUsageParams = {
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
    totalTokens?: number;
  };
  platform?: "web" | "line" | "lp";
  source: "chat" | "persona-extract" | "weekly-report" | "intent-classify";
  intent?: "casual" | "thinking";
  threadId?: string;
};

/**
 * LLM 呼び出しのトークン使用量を記録する。
 * 計測は本処理の付随なので、失敗しても throw せずログのみ残す。
 */
export const recordLlmUsage = async (
  d1: D1Database,
  params: LlmUsageParams,
) => {
  try {
    const db = createDb(d1);
    await db.insert(llmUsage).values({
      id: crypto.randomUUID(),
      model: params.model,
      inputTokens: params.usage?.inputTokens ?? 0,
      outputTokens: params.usage?.outputTokens ?? 0,
      reasoningTokens: params.usage?.reasoningTokens ?? 0,
      cachedInputTokens: params.usage?.cachedInputTokens ?? 0,
      totalTokens: params.usage?.totalTokens ?? 0,
      platform: params.platform,
      source: params.source,
      intent: params.intent,
      threadId: params.threadId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn("[LlmUsage] failed to record usage", { error: String(error) });
  }
};

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
  platform?: "web" | "line" | "lp" | "widget";
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
    const inputTokens = params.usage?.inputTokens ?? 0;
    const outputTokens = params.usage?.outputTokens ?? 0;
    const reasoningTokens = params.usage?.reasoningTokens ?? 0;
    await db.insert(llmUsage).values({
      id: crypto.randomUUID(),
      model: params.model,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cachedInputTokens: params.usage?.cachedInputTokens ?? 0,
      // プロバイダが totalTokens を返さない場合は内訳から合算する
      totalTokens:
        params.usage?.totalTokens ??
        inputTokens + outputTokens + reasoningTokens,
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

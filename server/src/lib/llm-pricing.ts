import { logger } from "~/lib/logger";

// USD per 1M tokens（OpenAI 2026-08-12・Gemini 2026-06-10 時点の公式 pricing。Gemini 行は過去の llm_usage 表示用）
// cached input は gpt-5.6 系が input の 10%、gpt-4.1-nano と Gemini（implicit caching）が 25%。
// modelId の部分一致で解決するため、"flash-lite" を "flash" より先に置くこと。
const PRICING = [
  { match: "luna", inputPer1M: 0.2, cachedInputPer1M: 0.02, outputPer1M: 1.2 },
  { match: "terra", inputPer1M: 2.0, cachedInputPer1M: 0.2, outputPer1M: 12.0 },
  { match: "sol", inputPer1M: 5.0, cachedInputPer1M: 0.5, outputPer1M: 30.0 },
  {
    match: "4.1-nano",
    inputPer1M: 0.1,
    cachedInputPer1M: 0.025,
    outputPer1M: 0.4,
  },
  {
    match: "embedding",
    inputPer1M: 0.15,
    cachedInputPer1M: 0.15,
    outputPer1M: 0,
  },
  {
    match: "flash-lite",
    inputPer1M: 0.1,
    cachedInputPer1M: 0.025,
    outputPer1M: 0.4,
  },
  {
    match: "flash",
    inputPer1M: 0.3,
    cachedInputPer1M: 0.075,
    outputPer1M: 2.5,
  },
  {
    match: "pro",
    inputPer1M: 1.25,
    cachedInputPer1M: 0.3125,
    outputPer1M: 10.0,
  },
] as const;

export const calcCostUsd = (
  model: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  },
) => {
  const pricing = PRICING.find((p) => model.includes(p.match));
  if (!pricing) {
    logger.warn(`[LlmPricing] unknown model: ${model}`);
    return 0;
  }
  // AI SDK の LanguageModelUsage 仕様: inputTokens はキャッシュ分、outputTokens は
  // reasoning 分を含む総数。reasoningTokens を別途加算すると二重課金になる
  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const freshInputTokens = Math.max(0, usage.inputTokens - cachedInputTokens);
  return (
    (freshInputTokens * pricing.inputPer1M) / 1_000_000 +
    (cachedInputTokens * pricing.cachedInputPer1M) / 1_000_000 +
    (usage.outputTokens * pricing.outputPer1M) / 1_000_000
  );
};

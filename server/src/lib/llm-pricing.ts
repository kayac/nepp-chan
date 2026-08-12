import { logger } from "~/lib/logger";

// USD per 1M tokens（OpenAI: https://developers.openai.com/api/docs/pricing 2026-08-12 時点、
// Gemini: https://ai.google.dev/gemini-api/docs/pricing 2026-06-10 時点。Gemini 行は過去の
// llm_usage レコードのコスト表示用に残す）
// どちらのプロバイダも reasoning トークンは output 単価で課金される。
// modelId の部分一致で解決するため、"flash-lite" を "flash" より先に置くこと。
const PRICING = [
  { match: "luna", inputPer1M: 0.2, outputPer1M: 1.2 },
  { match: "terra", inputPer1M: 2.0, outputPer1M: 12.0 },
  { match: "sol", inputPer1M: 5.0, outputPer1M: 30.0 },
  { match: "flash-lite", inputPer1M: 0.1, outputPer1M: 0.4 },
  { match: "flash", inputPer1M: 0.3, outputPer1M: 2.5 },
  { match: "pro", inputPer1M: 1.25, outputPer1M: 10.0 },
] as const;

export const calcCostUsd = (
  model: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens?: number;
  },
) => {
  const pricing = PRICING.find((p) => model.includes(p.match));
  if (!pricing) {
    logger.warn(`[LlmPricing] unknown model: ${model}`);
    return 0;
  }
  const outputTokens = usage.outputTokens + (usage.reasoningTokens ?? 0);
  return (
    (usage.inputTokens * pricing.inputPer1M) / 1_000_000 +
    (outputTokens * pricing.outputPer1M) / 1_000_000
  );
};

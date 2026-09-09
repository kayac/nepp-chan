import { formatCostJpy } from "@nepp-chan/shared/constants/currency";
import { calcCostUsd } from "~/lib/llm-pricing";

type SdkUsage = {
  inputTokens?: number;
  outputTokens?: number;
  inputTokenDetails?: { cacheReadTokens?: number };
};

type ProviderUsage = {
  inputTokens: { total?: number; cacheRead?: number };
  outputTokens: { total?: number };
};

export type UsageTotals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

export const emptyUsage = (): UsageTotals => ({
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
});

export const addUsage = (totals: UsageTotals, usage: SdkUsage | undefined) => {
  if (!usage) return totals;
  totals.calls += 1;
  totals.inputTokens += usage.inputTokens ?? 0;
  totals.outputTokens += usage.outputTokens ?? 0;
  totals.cachedInputTokens += usage.inputTokenDetails?.cacheReadTokens ?? 0;
  return totals;
};

export const addProviderUsage = (
  totals: UsageTotals,
  usage: ProviderUsage | undefined,
) => {
  if (!usage) return totals;
  totals.calls += 1;
  totals.inputTokens += usage.inputTokens.total ?? 0;
  totals.outputTokens += usage.outputTokens.total ?? 0;
  totals.cachedInputTokens += usage.inputTokens.cacheRead ?? 0;
  return totals;
};

export const sumUsage = (items: UsageTotals[]) =>
  items.reduce(
    (acc, u) => ({
      calls: acc.calls + u.calls,
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      cachedInputTokens: acc.cachedInputTokens + u.cachedInputTokens,
    }),
    emptyUsage(),
  );

export const costUsd = (model: string, totals: UsageTotals) =>
  calcCostUsd(model, totals);

export const formatUsd = (usd: number) =>
  `$${usd.toFixed(4)}（${formatCostJpy(usd)}）`;

export const formatCost = (label: string, model: string, totals: UsageTotals) =>
  `${label} ${model}: ${totals.calls} calls, in ${totals.inputTokens} (cached ${totals.cachedInputTokens}) / out ${totals.outputTokens} → ${formatUsd(costUsd(model, totals))}`;

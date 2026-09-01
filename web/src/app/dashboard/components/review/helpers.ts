import type { ReviewQueueItem } from "~/types";

export const REVIEW_DECISION_LABELS: Record<string, string> = {
  no_issue: "問題なし",
  incorrect: "誤り",
  source_missing: "情報源不足",
};

export type DecidedFilter = "undecided" | "decided" | "all";

export const toDecidedParam = (filter: DecidedFilter) =>
  filter === "all" ? undefined : filter === "decided";

export const flagLabels = (flags: ReviewQueueItem["flags"]) => {
  const labels: string[] = [];
  if (flags.badFeedback) labels.push("Bad評価");
  if (flags.zeroHit) labels.push("検索0件");
  if (flags.webFallback) labels.push("Web補完");
  return labels;
};

export const primaryQuery = (queries: readonly string[]) => queries[0] ?? "";

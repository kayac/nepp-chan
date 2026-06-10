// ペルソナ sentiment の表示順・ラベル・色（積み上げチャート共通）
export const SENTIMENT_SERIES = [
  { key: "positive", label: "ポジティブ", color: "#0d9488" }, // teal-600
  { key: "negative", label: "ネガティブ", color: "#e11d48" }, // rose-600
  { key: "request", label: "要望", color: "#d97706" }, // amber-600
  { key: "neutral", label: "中立", color: "#a8a29e" }, // stone-400
] as const;

type WeeklyUsageRow = {
  weekStart: string;
  model: string;
  totalTokens: number;
  costUsd: number;
};

/** 週×モデルのフラット行を積み上げバー用に { weekStart, [model]: totalTokens } へ変換する */
export const pivotWeeklyUsage = (weekly: WeeklyUsageRow[]) => {
  const models = [...new Set(weekly.map((w) => w.model))];
  const weeks = [...new Set(weekly.map((w) => w.weekStart))];

  const rows = weeks.map((weekStart) => ({
    weekStart,
    ...Object.fromEntries(
      weekly
        .filter((w) => w.weekStart === weekStart)
        .map((w) => [w.model, w.totalTokens]),
    ),
  }));

  return { models, rows };
};

export const formatCostUsd = (value: number) => `$${value.toFixed(4)}`;

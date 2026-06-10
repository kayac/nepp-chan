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

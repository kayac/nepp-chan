const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const toJstDate = (d: Date) =>
  new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);

/** 直近 days 日の JST 日付範囲（from は days-1 日前、to は今日。両端を含む） */
export const jstDateRange = (days: number, now: Date = new Date()) => ({
  from: toJstDate(new Date(now.getTime() - (days - 1) * DAY_MS)),
  to: toJstDate(now),
});

type WeeklyUsageRow = {
  weekStart: string;
  model: string;
  totalTokens: number;
  costUsd: number;
};

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

const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export const formatCostUsd = (value: number) => usdFormat.format(value);

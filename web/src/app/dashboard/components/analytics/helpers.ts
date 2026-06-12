// ペルソナ sentiment の表示順・ラベル・色（積み上げチャート共通）
export const SENTIMENT_SERIES = [
  { key: "positive", label: "ポジティブ", color: "#0d9488" }, // teal-600
  { key: "negative", label: "ネガティブ", color: "#e11d48" }, // rose-600
  { key: "request", label: "要望", color: "#d97706" }, // amber-600
  { key: "neutral", label: "中立", color: "#a8a29e" }, // stone-400
] as const;

export type SentimentCounts = {
  positive: number;
  negative: number;
  request: number;
  neutral: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const toJstDate = (d: Date) =>
  new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);

/** 直近 days 日の JST 日付範囲（from は days-1 日前、to は今日。両端を含む） */
export const jstDateRange = (days: number, now: Date = new Date()) => ({
  from: toJstDate(new Date(now.getTime() - (days - 1) * DAY_MS)),
  to: toJstDate(now),
});

/** 1 行の sentiment 内訳の合計件数 */
export const sentimentTotal = (row: SentimentCounts) =>
  row.positive + row.negative + row.request + row.neutral;

/** sentiment 内訳を持つ行の合計を出す */
export const sumSentiments = (rows: SentimentCounts[]): SentimentCounts =>
  rows.reduce(
    (acc, row) => ({
      positive: acc.positive + row.positive,
      negative: acc.negative + row.negative,
      request: acc.request + row.request,
      neutral: acc.neutral + row.neutral,
    }),
    { positive: 0, negative: 0, request: 0, neutral: 0 },
  );

/** 件数の多い順に上位 n 件（0 件は除外） */
export const topEntries = (
  entries: { label: string; count: number }[],
  n: number,
) =>
  entries
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, n);

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

const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export const formatCostUsd = (value: number) => usdFormat.format(value);

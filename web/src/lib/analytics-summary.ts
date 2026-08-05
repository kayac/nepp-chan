export const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  line: "LINE",
  admin: "管理者",
};

export const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export type SentimentCounts = {
  positive: number;
  negative: number;
  request: number;
  neutral: number;
};

export const sentimentTotal = (row: SentimentCounts) =>
  row.positive + row.negative + row.request + row.neutral;

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

export const topEntries = (
  entries: { label: string; count: number }[],
  n: number,
) =>
  entries
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, n);

export const closedContext = (open: number, closed: number) => {
  const total = open + closed;
  if (closed <= 0 || total <= 0) {
    return null;
  }
  return {
    percent: Math.round((closed / total) * 100),
    perN: Math.max(1, Math.round(total / closed)),
  };
};

type DailyRow = { date: string; conversations: number };

// JST の日付文字列を UTC 深夜として読むと曜日は端末のタイムゾーンに影響されない
const dowOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

export const dailyBars = (daily: DailyRow[]) =>
  daily.map((row) => {
    const dow = dowOf(row.date);
    const [, month, day] = row.date.split("-");
    return {
      date: row.date,
      label: `${Number(month)}/${Number(day)}(${DOW_LABELS[dow]})`,
      conversations: row.conversations,
      closed: dow === 0 || dow === 6,
    };
  });

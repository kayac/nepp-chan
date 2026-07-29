import { startOfWeek, toDateString } from "~/lib/date";

type TopicCounts = {
  topic: string;
  total: number;
  positive: number;
  negative: number;
  request: number;
  neutral: number;
};

const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

export const weekPeriods = (now: Date) => {
  const monday = startOfWeek(now);
  const prevMonday = addDays(monday, -7);
  const prevSunday = addDays(monday, -1);
  return {
    current: { from: toDateString(monday), to: toDateString(now) },
    previous: { from: toDateString(prevMonday), to: toDateString(prevSunday) },
  };
};

const troubleCount = (t: TopicCounts) => t.negative + t.request;

// previous が undefined のとき（前週データ未取得）は増減や NEW を出さない
export const troubleTopics = (
  current: TopicCounts[],
  previous: TopicCounts[] | undefined,
  limit = 3,
) =>
  current
    .filter((t) => troubleCount(t) > 0)
    .map((t) => {
      const prev = previous?.find((p) => p.topic === t.topic);
      return {
        topic: t.topic,
        count: troubleCount(t),
        diff: previous ? troubleCount(t) - (prev ? troubleCount(prev) : 0) : 0,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

export const topTopics = (
  current: TopicCounts[],
  previous: TopicCounts[] | undefined,
  limit = 4,
) =>
  current
    .filter((t) => t.total > 0)
    .map((t) => {
      const prevTotal = previous?.find((p) => p.topic === t.topic)?.total ?? 0;
      return {
        topic: t.topic,
        total: t.total,
        diff: previous ? t.total - prevTotal : 0,
        isNew: previous ? prevTotal === 0 : false,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

export const sumConversationsInRange = (
  daily: { date: string; conversations: number }[],
  from: string,
  to: string,
) =>
  daily
    .filter((d) => d.date >= from && d.date <= to)
    .reduce((sum, d) => sum + d.conversations, 0);

export const percentChange = (current: number, previous: number) =>
  previous === 0 ? null : Math.round(((current - previous) / previous) * 100);

type TopicCounts = {
  topic: string;
  total: number;
  positive: number;
  negative: number;
  request: number;
  neutral: number;
};

export const toDateString = (d: Date) => formatDate(d);

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

export const weekPeriods = (now: Date) => {
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = addDays(now, -mondayOffset);
  const prevMonday = addDays(monday, -7);
  const prevSunday = addDays(monday, -1);
  return {
    current: { from: formatDate(monday), to: formatDate(now) },
    previous: { from: formatDate(prevMonday), to: formatDate(prevSunday) },
  };
};

const troubleCount = (t: TopicCounts) => t.negative + t.request;

export const troubleTopics = (
  current: TopicCounts[],
  previous: TopicCounts[],
  limit = 3,
) =>
  current
    .filter((t) => troubleCount(t) > 0)
    .map((t) => ({
      topic: t.topic,
      count: troubleCount(t),
      diff:
        troubleCount(t) -
        troubleCount(
          previous.find((p) => p.topic === t.topic) ?? {
            ...t,
            negative: 0,
            request: 0,
          },
        ),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

export const topTopics = (
  current: TopicCounts[],
  previous: TopicCounts[],
  limit = 4,
) =>
  current
    .filter((t) => t.total > 0)
    .map((t) => {
      const prevTotal = previous.find((p) => p.topic === t.topic)?.total ?? 0;
      return {
        topic: t.topic,
        total: t.total,
        diff: t.total - prevTotal,
        isNew: prevTotal === 0,
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

import { and, gte, lt, sql } from "drizzle-orm";
import { createDb, persona } from "~/db";
import { calcCostUsd } from "~/lib/llm-pricing";

// D1 の createdAt は UTC ISO 文字列。集計はすべて JST（+9 hours）で行い、
// API は JST ラベル済みのデータを返す（フロントでは変換しない）。

type Period = { from: string; to: string };

const AGE_GROUPS = [
  "10代",
  "20代",
  "30代",
  "40代",
  "50代",
  "60代",
  "70代",
  "80代以上",
  "不明",
] as const;

const TOPICS = [
  "交通",
  "買い物",
  "医療",
  "除雪",
  "教育",
  "行政",
  "観光",
  "生活",
  "その他",
] as const;

const SENTIMENTS = ["positive", "negative", "request", "neutral"] as const;
type Sentiment = (typeof SENTIMENTS)[number];

const RESIDENCES = ["村内", "村外"] as const;
const RELATIONSHIPS = ["村人", "観光客", "移住検討者", "帰省者"] as const;

export const getConversationStats = async (d1: D1Database, period: Period) => {
  const db = createDb(d1);

  const [hourlyRows, daily, platforms, totalsRow] = await Promise.all([
    db.all<{ hour: number; count: number }>(sql`
      SELECT CAST(strftime('%H', createdAt, '+9 hours') AS INTEGER) AS hour,
             COUNT(*) AS count
      FROM mastra_messages
      WHERE role = 'user' AND createdAt >= ${period.from} AND createdAt < ${period.to}
      GROUP BY hour
    `),
    db.all<{ date: string; conversations: number; messages: number }>(sql`
      SELECT strftime('%Y-%m-%d', createdAt, '+9 hours') AS date,
             COUNT(DISTINCT thread_id) AS conversations,
             COUNT(*) AS messages
      FROM mastra_messages
      WHERE role = 'user' AND createdAt >= ${period.from} AND createdAt < ${period.to}
      GROUP BY date
      ORDER BY date
    `),
    db.all<{ platform: string; count: number }>(sql`
      SELECT CASE WHEN t.resourceId LIKE 'line:%' THEN 'line'
                  WHEN t.resourceId LIKE 'admin:%' THEN 'admin'
                  ELSE 'web' END AS platform,
             COUNT(*) AS count
      FROM mastra_messages m
      JOIN mastra_threads t ON m.thread_id = t.id
      WHERE m.role = 'user' AND m.createdAt >= ${period.from} AND m.createdAt < ${period.to}
      GROUP BY platform
    `),
    db.get<{ conversations: number; messages: number }>(sql`
      SELECT COUNT(DISTINCT thread_id) AS conversations, COUNT(*) AS messages
      FROM mastra_messages
      WHERE role = 'user' AND createdAt >= ${period.from} AND createdAt < ${period.to}
    `),
  ]);

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: Number(hourlyRows.find((r) => Number(r.hour) === hour)?.count ?? 0),
  }));

  return {
    daily: daily.map((r) => ({
      date: r.date,
      conversations: Number(r.conversations),
      messages: Number(r.messages),
    })),
    hourly,
    platforms: platforms.map((r) => ({
      platform: r.platform,
      count: Number(r.count),
    })),
    totals: {
      conversations: Number(totalsRow?.conversations ?? 0),
      messages: Number(totalsRow?.messages ?? 0),
    },
  };
};

type UsageSumRow = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
};

const withCost = (row: UsageSumRow) => {
  const summed = {
    model: row.model,
    inputTokens: Number(row.inputTokens),
    outputTokens: Number(row.outputTokens),
    reasoningTokens: Number(row.reasoningTokens),
    cachedInputTokens: Number(row.cachedInputTokens),
    totalTokens: Number(row.totalTokens),
  };
  return { ...summed, costUsd: calcCostUsd(row.model, summed) };
};

export const getWeeklyUsage = async (
  d1: D1Database,
  params: { from: string },
) => {
  const db = createDb(d1);

  // '-6 days' で戻してから 'weekday 1' で進めると「その日を含む週の月曜」に正規化される
  const rows = await db.all<UsageSumRow & { weekStart: string }>(sql`
    SELECT date(created_at, '+9 hours', '-6 days', 'weekday 1') AS weekStart,
           model,
           SUM(input_tokens) AS inputTokens,
           SUM(output_tokens) AS outputTokens,
           SUM(reasoning_tokens) AS reasoningTokens,
           SUM(cached_input_tokens) AS cachedInputTokens,
           SUM(total_tokens) AS totalTokens
    FROM llm_usage
    WHERE created_at >= ${params.from}
    GROUP BY weekStart, model
    ORDER BY weekStart, model
  `);

  return rows.map((row) => ({ weekStart: row.weekStart, ...withCost(row) }));
};

export const getUsageByModel = async (d1: D1Database, period: Period) => {
  const db = createDb(d1);

  const rows = await db.all<UsageSumRow>(sql`
    SELECT model,
           SUM(input_tokens) AS inputTokens,
           SUM(output_tokens) AS outputTokens,
           SUM(reasoning_tokens) AS reasoningTokens,
           SUM(cached_input_tokens) AS cachedInputTokens,
           SUM(total_tokens) AS totalTokens
    FROM llm_usage
    WHERE created_at >= ${period.from} AND created_at < ${period.to}
    GROUP BY model
    ORDER BY model
  `);

  return rows.map(withCost);
};

const extractAgeGroup = (attributes: string) => {
  const matched = attributes.match(/(\d0)代/);
  if (!matched) {
    return "不明";
  }
  const decade = Number(matched[1]);
  if (decade >= 80) {
    return "80代以上";
  }
  return decade >= 10 ? `${decade}代` : "不明";
};

const normalizeSentiment = (sentiment: string | null): Sentiment =>
  SENTIMENTS.includes(sentiment as Sentiment)
    ? (sentiment as Sentiment)
    : "neutral";

const emptySentimentCounts = () => ({
  positive: 0,
  negative: 0,
  request: 0,
  neutral: 0,
});

export const getPersonaAnalytics = async (
  d1: D1Database,
  params: { from?: string; to?: string },
) => {
  const db = createDb(d1);

  const conditions = [
    params.from ? gte(persona.createdAt, params.from) : undefined,
    params.to ? lt(persona.createdAt, params.to) : undefined,
  ].filter((c) => c !== undefined);

  const rows = await db
    .select({
      tags: persona.tags,
      demographicSummary: persona.demographicSummary,
      topic: persona.topic,
      sentiment: persona.sentiment,
    })
    .from(persona)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all();

  const ageSentiment = new Map(
    AGE_GROUPS.map((age) => [age as string, emptySentimentCounts()]),
  );
  const topics = new Map(
    TOPICS.map((topic) => [
      topic as string,
      { total: 0, ...emptySentimentCounts() },
    ]),
  );
  const residence = new Map<string, number>();
  const relationship = new Map<string, number>();

  for (const row of rows) {
    const attributes = [row.tags, row.demographicSummary]
      .filter(Boolean)
      .join(",");
    const sentiment = normalizeSentiment(row.sentiment);

    const ageCounts = ageSentiment.get(extractAgeGroup(attributes));
    if (ageCounts) {
      ageCounts[sentiment] += 1;
    }

    const topicKey = TOPICS.includes(row.topic as (typeof TOPICS)[number])
      ? (row.topic as string)
      : "その他";
    const topicCounts = topics.get(topicKey);
    if (topicCounts) {
      topicCounts.total += 1;
      topicCounts[sentiment] += 1;
    }

    const residenceKey =
      RESIDENCES.find((r) => attributes.includes(r)) ?? "不明";
    residence.set(residenceKey, (residence.get(residenceKey) ?? 0) + 1);

    const relationshipKey =
      RELATIONSHIPS.find((r) => attributes.includes(r)) ?? "不明";
    relationship.set(
      relationshipKey,
      (relationship.get(relationshipKey) ?? 0) + 1,
    );
  }

  return {
    totalCount: rows.length,
    ageSentiment: AGE_GROUPS.map((age) => ({
      age,
      ...(ageSentiment.get(age) ?? emptySentimentCounts()),
    })),
    topics: TOPICS.map((topic) => ({
      topic,
      ...(topics.get(topic) ?? { total: 0, ...emptySentimentCounts() }),
    })),
    segments: {
      residence: [...residence.entries()].map(([label, count]) => ({
        label,
        count,
      })),
      relationship: [...relationship.entries()].map(([label, count]) => ({
        label,
        count,
      })),
    },
  };
};

import {
  classifyRelationship,
  normalizeSentiment,
  normalizeTopic,
  personaAttributes,
  TOPICS,
} from "@nepp-chan/shared/lib/persona-attributes";
import { and, gte, isNotNull, lt, sql } from "drizzle-orm";
import { createDb, persona } from "~/db";
import { calcCostUsd } from "~/lib/llm-pricing";

// D1 の createdAt は UTC ISO 文字列。集計はすべて JST（+9 hours）で行い、
// API は JST ラベル済みのデータを返す（フロントでは変換しない）。

type Period = { from: string; to: string };

// 0〜23 時の全時間帯を 0 件で埋めた配列にする（欠けた時間帯はグラフに出ないため）
const fillHours = (rows: { hour: number; count: number }[]) =>
  Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: Number(rows.find((r) => Number(r.hour) === hour)?.count ?? 0),
  }));

// 0（日曜）〜6（土曜）の全曜日を 0 件で埋めた配列にする
const fillWeekdays = (rows: { dow: number; count: number }[]) =>
  Array.from({ length: 7 }, (_, dow) => ({
    dow,
    count: Number(rows.find((r) => Number(r.dow) === dow)?.count ?? 0),
  }));

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

const RESIDENCES = ["村内", "村外"] as const;

export const getConversationStats = async (d1: D1Database, period: Period) => {
  const db = createDb(d1);

  const [hourlyRows, weekdayRows, daily, platforms, totalsRow] =
    await Promise.all([
      db.all<{ hour: number; count: number }>(sql`
      SELECT CAST(strftime('%H', createdAt, '+9 hours') AS INTEGER) AS hour,
             COUNT(*) AS count
      FROM mastra_messages
      WHERE role = 'user' AND createdAt >= ${period.from} AND createdAt < ${period.to}
      GROUP BY hour
    `),
      db.all<{ dow: number; count: number }>(sql`
      SELECT CAST(strftime('%w', createdAt, '+9 hours') AS INTEGER) AS dow,
             COUNT(*) AS count
      FROM mastra_messages
      WHERE role = 'user' AND createdAt >= ${period.from} AND createdAt < ${period.to}
      GROUP BY dow
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

  return {
    daily: daily.map((r) => ({
      date: r.date,
      conversations: Number(r.conversations),
      messages: Number(r.messages),
    })),
    hourly: fillHours(hourlyRows),
    weekday: fillWeekdays(weekdayRows),
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
  persistedCostUsd: number;
  legacyInputTokens: number;
  legacyOutputTokens: number;
  legacyCachedInputTokens: number;
};

// トークン合算と costUsd 算出用の SELECT 列。
// cost_usd は記録時点の単価で永続化されるが、永続化開始前の行（NULL）は
// legacy* のトークン数から現行単価で概算して合算する
const usageSumColumns = sql`
  SUM(input_tokens) AS inputTokens,
  SUM(output_tokens) AS outputTokens,
  SUM(reasoning_tokens) AS reasoningTokens,
  SUM(cached_input_tokens) AS cachedInputTokens,
  SUM(total_tokens) AS totalTokens,
  SUM(COALESCE(cost_usd, 0)) AS persistedCostUsd,
  SUM(CASE WHEN cost_usd IS NULL THEN input_tokens ELSE 0 END) AS legacyInputTokens,
  SUM(CASE WHEN cost_usd IS NULL THEN output_tokens ELSE 0 END) AS legacyOutputTokens,
  SUM(CASE WHEN cost_usd IS NULL THEN cached_input_tokens ELSE 0 END) AS legacyCachedInputTokens
`;

const usageCostUsd = (row: UsageSumRow) =>
  Number(row.persistedCostUsd) +
  calcCostUsd(row.model, {
    inputTokens: Number(row.legacyInputTokens),
    outputTokens: Number(row.legacyOutputTokens),
    cachedInputTokens: Number(row.legacyCachedInputTokens),
  });

const withCost = (row: UsageSumRow) => ({
  model: row.model,
  inputTokens: Number(row.inputTokens),
  outputTokens: Number(row.outputTokens),
  reasoningTokens: Number(row.reasoningTokens),
  cachedInputTokens: Number(row.cachedInputTokens),
  totalTokens: Number(row.totalTokens),
  costUsd: usageCostUsd(row),
});

export const getWeeklyUsage = async (
  d1: D1Database,
  params: { from: string },
) => {
  const db = createDb(d1);

  // '-6 days' で戻してから 'weekday 1' で進めると「その日を含む週の月曜」に正規化される
  const rows = await db.all<UsageSumRow & { weekStart: string }>(sql`
    SELECT date(created_at, '+9 hours', '-6 days', 'weekday 1') AS weekStart,
           model,
           ${usageSumColumns}
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
           ${usageSumColumns}
    FROM llm_usage
    WHERE created_at >= ${period.from} AND created_at < ${period.to}
    GROUP BY model
    ORDER BY model
  `);

  return rows.map(withCost);
};

type ThreadUsageRow = UsageSumRow & {
  threadId: string;
  agent: string | null;
  platform: string | null;
  chatCalls: number;
};

type AgentTotals = {
  agent: string | null;
  totalTokens: number;
  costUsd: number;
};

const addAgentTotals = (
  map: Map<string | null, AgentTotals>,
  row: UsageSumRow & { agent: string | null },
) => {
  const current = map.get(row.agent) ?? {
    agent: row.agent,
    totalTokens: 0,
    costUsd: 0,
  };
  current.totalTokens += Number(row.totalTokens);
  current.costUsd += usageCostUsd(row);
  map.set(row.agent, current);
};

const sortedAgentTotals = (map: Map<string | null, AgentTotals>) =>
  [...map.values()].sort((a, b) => b.costUsd - a.costUsd);

// 会話に直接かかった費用と、それ以外の運用費を分けて見るための区分。
// embedding は検索クエリ分（スレッドに紐づく）が会話、ナレッジ同期分が基盤
const usageCategoryExpr = sql`
  CASE
    WHEN source IN ('chat', 'subagent', 'intent-classify', 'rerank') THEN 'conversation'
    WHEN source = 'embedding' AND thread_id IS NOT NULL THEN 'conversation'
    WHEN source = 'embedding' THEN 'knowledge-base'
    ELSE 'batch'
  END
`;

// 請求元の突き合わせ用。モデル ID からプロバイダを判定する
const providerOf = (model: string) => {
  if (model.includes("gemini")) return "google";
  if (model.includes("gpt")) return "openai";
  return "other";
};

type ProviderTotals = {
  provider: string;
  totalTokens: number;
  costUsd: number;
};

const addProviderTotals = (
  map: Map<string, ProviderTotals>,
  row: UsageSumRow,
) => {
  const provider = providerOf(row.model);
  const current = map.get(provider) ?? {
    provider,
    totalTokens: 0,
    costUsd: 0,
  };
  current.totalTokens += Number(row.totalTokens);
  current.costUsd += usageCostUsd(row);
  map.set(provider, current);
};

export const getOperationCost = async (d1: D1Database, period: Period) => {
  const db = createDb(d1);

  const [rows, dailyRows] = await Promise.all([
    db.all<UsageSumRow & { category: string; agent: string | null }>(sql`
      SELECT ${usageCategoryExpr} AS category,
             agent,
             model,
             ${usageSumColumns}
      FROM llm_usage
      WHERE created_at >= ${period.from} AND created_at < ${period.to}
      GROUP BY category, agent, model
    `),
    db.all<UsageSumRow & { date: string }>(sql`
      SELECT date(created_at, '+9 hours') AS date,
             model,
             ${usageSumColumns}
      FROM llm_usage
      WHERE created_at >= ${period.from} AND created_at < ${period.to}
      GROUP BY date, model
      ORDER BY date
    `),
  ]);

  const dailyTotals = new Map<string, number>();
  for (const row of dailyRows) {
    dailyTotals.set(
      row.date,
      (dailyTotals.get(row.date) ?? 0) + usageCostUsd(row),
    );
  }

  const byCategory = new Map<
    string,
    {
      category: string;
      costUsd: number;
      agentTotals: Map<string | null, AgentTotals>;
    }
  >();
  const byProvider = new Map<string, ProviderTotals>();
  for (const row of rows) {
    const current = byCategory.get(row.category) ?? {
      category: row.category,
      costUsd: 0,
      agentTotals: new Map<string | null, AgentTotals>(),
    };
    current.costUsd += usageCostUsd(row);
    addAgentTotals(current.agentTotals, row);
    byCategory.set(row.category, current);
    addProviderTotals(byProvider, row);
  }

  return {
    totalCostUsd: [...byCategory.values()].reduce(
      (sum, c) => sum + c.costUsd,
      0,
    ),
    byCategory: [...byCategory.values()]
      .sort((a, b) => b.costUsd - a.costUsd)
      .map(({ agentTotals, ...category }) => ({
        ...category,
        agents: sortedAgentTotals(agentTotals),
      })),
    byProvider: [...byProvider.values()].sort((a, b) => b.costUsd - a.costUsd),
    daily: [...dailyTotals.entries()].map(([date, costUsd]) => ({
      date,
      costUsd,
    })),
  };
};

export const getThreadUsage = async (
  d1: D1Database,
  period: Period,
  params: { limit: number },
) => {
  const db = createDb(d1);

  const [threadModelRows, messageRows] = await Promise.all([
    db.all<ThreadUsageRow>(sql`
      SELECT thread_id AS threadId,
             agent,
             model,
             MAX(platform) AS platform,
             SUM(CASE WHEN source = 'chat' THEN 1 ELSE 0 END) AS chatCalls,
             ${usageSumColumns}
      FROM llm_usage
      WHERE created_at >= ${period.from} AND created_at < ${period.to}
        AND thread_id IS NOT NULL
        AND ${usageCategoryExpr} = 'conversation'
      GROUP BY thread_id, agent, model
    `),
    db.all<{
      threadId: string;
      firstMessageAt: string;
      lastMessageAt: string;
    }>(sql`
      SELECT thread_id AS threadId,
             MIN(createdAt) AS firstMessageAt,
             MAX(createdAt) AS lastMessageAt
      FROM mastra_messages
      WHERE createdAt >= ${period.from} AND createdAt < ${period.to}
        AND thread_id IN (
          SELECT DISTINCT thread_id FROM llm_usage
          WHERE created_at >= ${period.from} AND created_at < ${period.to}
            AND thread_id IS NOT NULL
        )
      GROUP BY thread_id
    `),
  ]);

  const messagesByThread = new Map(
    messageRows.map((row) => [row.threadId, row]),
  );

  type ThreadTotals = {
    threadId: string;
    platform: string | null;
    messageCount: number;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cachedInputTokens: number;
    totalTokens: number;
    costUsd: number;
    models: string[];
    agentTotals: Map<string | null, AgentTotals>;
  };
  const threadTotals = new Map<string, ThreadTotals>();
  const byAgent = new Map<string | null, AgentTotals>();
  for (const row of threadModelRows) {
    const current = threadTotals.get(row.threadId) ?? {
      threadId: row.threadId,
      platform: null,
      messageCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      models: [],
      agentTotals: new Map<string | null, AgentTotals>(),
    };
    current.platform = current.platform ?? row.platform;
    current.messageCount += Number(row.chatCalls);
    current.inputTokens += Number(row.inputTokens);
    current.outputTokens += Number(row.outputTokens);
    current.reasoningTokens += Number(row.reasoningTokens);
    current.cachedInputTokens += Number(row.cachedInputTokens);
    current.totalTokens += Number(row.totalTokens);
    current.costUsd += usageCostUsd(row);
    if (!current.models.includes(row.model)) {
      current.models.push(row.model);
    }
    addAgentTotals(current.agentTotals, row);
    addAgentTotals(byAgent, row);
    threadTotals.set(row.threadId, current);
  }
  for (const thread of threadTotals.values()) {
    thread.models.sort();
  }

  const threads = [...threadTotals.values()]
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, params.limit)
    .map((thread) => {
      const message = messagesByThread.get(thread.threadId);
      const durationSeconds = message
        ? Math.round(
            (new Date(message.lastMessageAt).getTime() -
              new Date(message.firstMessageAt).getTime()) /
              1000,
          )
        : null;
      const { agentTotals, ...rest } = thread;
      return {
        ...rest,
        agents: sortedAgentTotals(agentTotals),
        firstMessageAt: message?.firstMessageAt ?? null,
        lastMessageAt: message?.lastMessageAt ?? null,
        durationSeconds,
      };
    });

  const allThreads = [...threadTotals.values()];
  const conversationCostUsd = allThreads.reduce((sum, t) => sum + t.costUsd, 0);
  const messages = allThreads.reduce((sum, t) => sum + t.messageCount, 0);
  const threadCount = allThreads.length;

  return {
    summary: {
      threads: threadCount,
      messages,
      conversationCostUsd,
      avgCostPerMessageUsd:
        messages > 0 ? conversationCostUsd / messages : null,
      avgCostPerThreadUsd:
        threadCount > 0 ? conversationCostUsd / threadCount : null,
      byAgent: sortedAgentTotals(byAgent),
    },
    threads,
  };
};

export const getThreadTurnUsage = async (d1: D1Database, threadId: string) => {
  const db = createDb(d1);

  const rows = await db.all<
    UsageSumRow & {
      turnIndex: number | null;
      agent: string | null;
      durationMs: number | null;
      answeredAt: string;
      intent: string | null;
    }
  >(sql`
    SELECT turn_index AS turnIndex,
           agent,
           model,
           MAX(CASE WHEN source = 'chat' THEN duration_ms END) AS durationMs,
           MAX(CASE WHEN source = 'chat' THEN created_at END) AS answeredAt,
           MAX(CASE WHEN source = 'chat' THEN intent END) AS intent,
           ${usageSumColumns}
    FROM llm_usage
    WHERE thread_id = ${threadId}
      AND ${usageCategoryExpr} = 'conversation'
    GROUP BY turn_index, agent, model
    ORDER BY turn_index, agent
  `);

  type TurnTotals = {
    turnIndex: number | null;
    totalTokens: number;
    costUsd: number;
    durationMs: number | null;
    answeredAt: string | null;
    intent: string | null;
    agentTotals: Map<string | null, AgentTotals>;
  };
  const turns = new Map<number | null, TurnTotals>();
  for (const row of rows) {
    const key = row.turnIndex === null ? null : Number(row.turnIndex);
    const current = turns.get(key) ?? {
      turnIndex: key,
      totalTokens: 0,
      costUsd: 0,
      durationMs: null,
      answeredAt: null,
      intent: null,
      agentTotals: new Map<string | null, AgentTotals>(),
    };
    current.totalTokens += Number(row.totalTokens);
    current.costUsd += usageCostUsd(row);
    current.durationMs = current.durationMs ?? row.durationMs ?? null;
    current.answeredAt = current.answeredAt ?? row.answeredAt ?? null;
    current.intent = current.intent ?? row.intent ?? null;
    addAgentTotals(current.agentTotals, row);
    turns.set(key, current);
  }

  return {
    // turn_index 記録前の行は turnIndex: null にまとまり、末尾に並ぶ
    turns: [...turns.values()]
      .sort(
        (a, b) =>
          (a.turnIndex ?? Number.MAX_SAFE_INTEGER) -
          (b.turnIndex ?? Number.MAX_SAFE_INTEGER),
      )
      .map(({ agentTotals, ...turn }) => ({
        ...turn,
        agents: sortedAgentTotals(agentTotals),
      })),
  };
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

export const emptySentimentCounts = () => ({
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

  // 期間はすべて会話終了時刻（conversationEndedAt）基準。
  // createdAt は抽出バッチの実行時刻で、会話のあった期間を表さないため
  const periodConditions = [
    params.from ? gte(persona.conversationEndedAt, params.from) : undefined,
    params.to ? lt(persona.conversationEndedAt, params.to) : undefined,
  ].filter((c) => c !== undefined);

  const hourExpr = sql<number>`CAST(strftime('%H', ${persona.conversationEndedAt}, '+9 hours') AS INTEGER)`;
  const dowExpr = sql<number>`CAST(strftime('%w', ${persona.conversationEndedAt}, '+9 hours') AS INTEGER)`;
  // 開庁 = 平日（月〜金）の 8〜17 時 JST。それ以外は閉庁
  const isOpenExpr = sql<number>`CASE WHEN ${dowExpr} BETWEEN 1 AND 5 AND ${hourExpr} BETWEEN 8 AND 16 THEN 1 ELSE 0 END`;
  const hourlyConditions = [
    isNotNull(persona.conversationEndedAt),
    ...periodConditions,
  ];

  const [rows, hourlyRows, weekdayRows, officeRow] = await Promise.all([
    db
      .select({
        tags: persona.tags,
        demographicSummary: persona.demographicSummary,
        topic: persona.topic,
        sentiment: persona.sentiment,
      })
      .from(persona)
      .where(periodConditions.length > 0 ? and(...periodConditions) : undefined)
      .all(),
    db
      .select({ hour: hourExpr, count: sql<number>`COUNT(*)` })
      .from(persona)
      .where(and(...hourlyConditions))
      .groupBy(hourExpr)
      .all(),
    db
      .select({ dow: dowExpr, count: sql<number>`COUNT(*)` })
      .from(persona)
      .where(and(...hourlyConditions))
      .groupBy(dowExpr)
      .all(),
    db
      .select({
        open: sql<number>`SUM(${isOpenExpr})`,
        total: sql<number>`COUNT(*)`,
      })
      .from(persona)
      .where(and(...hourlyConditions))
      .get(),
  ]);

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
    const attributes = personaAttributes(row);
    const sentiment = normalizeSentiment(row.sentiment);

    const ageCounts = ageSentiment.get(extractAgeGroup(attributes));
    if (ageCounts) {
      ageCounts[sentiment] += 1;
    }

    const topicCounts = topics.get(normalizeTopic(row.topic));
    if (topicCounts) {
      topicCounts.total += 1;
      topicCounts[sentiment] += 1;
    }

    const residenceKey =
      RESIDENCES.find((r) => attributes.includes(r)) ?? "不明";
    residence.set(residenceKey, (residence.get(residenceKey) ?? 0) + 1);

    const relationshipKey = classifyRelationship(attributes) ?? "不明";
    relationship.set(
      relationshipKey,
      (relationship.get(relationshipKey) ?? 0) + 1,
    );
  }

  const officeOpen = Number(officeRow?.open ?? 0);
  const officeTotal = Number(officeRow?.total ?? 0);

  return {
    totalCount: rows.length,
    hourly: fillHours(hourlyRows),
    weekday: fillWeekdays(weekdayRows),
    officeHours: { open: officeOpen, closed: officeTotal - officeOpen },
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

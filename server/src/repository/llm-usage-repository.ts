import { and, count, eq, sql } from "drizzle-orm";

import { createDb, llmUsage, type NewLlmUsage } from "~/db";
import { deleteWithCount } from "./delete-with-count";

type Period = { from: string; to: string };

export type UsageSumRow = {
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

// cost_usd は記録時点の単価で永続化されるが、永続化開始前の行（NULL）は
// legacy* のトークン数から呼び出し側が現行単価で概算して合算する
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

export const llmUsageRepository = {
  async create(d1: D1Database, input: NewLlmUsage) {
    const db = createDb(d1);

    await db.insert(llmUsage).values(input);
  },

  async countChatByThread(d1: D1Database, threadId: string) {
    const db = createDb(d1);

    const row = await db
      .select({ value: count() })
      .from(llmUsage)
      .where(and(eq(llmUsage.threadId, threadId), eq(llmUsage.source, "chat")))
      .get();

    return Number(row?.value ?? 0);
  },

  async sumByDateAndModel(
    d1: D1Database,
    params: { from: string; to?: string },
  ) {
    const db = createDb(d1);

    const until = params.to ? sql`AND created_at < ${params.to}` : sql``;

    return db.all<UsageSumRow & { date: string }>(sql`
      SELECT date(created_at, '+9 hours') AS date,
             model,
             ${usageSumColumns}
      FROM llm_usage
      WHERE created_at >= ${params.from} ${until}
      GROUP BY date, model
      ORDER BY date, model
    `);
  },

  async sumByModel(d1: D1Database, period: Period) {
    const db = createDb(d1);

    return db.all<UsageSumRow>(sql`
      SELECT model,
             ${usageSumColumns}
      FROM llm_usage
      WHERE created_at >= ${period.from} AND created_at < ${period.to}
      GROUP BY model
      ORDER BY model
    `);
  },

  async sumByCategory(d1: D1Database, period: Period) {
    const db = createDb(d1);

    return db.all<UsageSumRow & { category: string; agent: string | null }>(sql`
      SELECT ${usageCategoryExpr} AS category,
             agent,
             model,
             ${usageSumColumns}
      FROM llm_usage
      WHERE created_at >= ${period.from} AND created_at < ${period.to}
      GROUP BY category, agent, model
    `);
  },

  async sumConversationByThread(d1: D1Database, period: Period) {
    const db = createDb(d1);

    return db.all<
      UsageSumRow & {
        threadId: string;
        agent: string | null;
        platform: string | null;
        chatCalls: number;
      }
    >(sql`
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
    `);
  },

  async sumConversationByTurn(d1: D1Database, threadId: string) {
    const db = createDb(d1);

    return db.all<
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
  },

  async deleteCreatedBefore(d1: D1Database, cutoff: string) {
    const db = createDb(d1);

    return deleteWithCount(
      db,
      llmUsage,
      sql`datetime(${llmUsage.createdAt}) < datetime(${cutoff})`,
    );
  },
};

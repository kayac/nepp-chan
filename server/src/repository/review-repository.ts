import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import {
  createDb,
  messageFeedback,
  type NewRetrievalRun,
  type NewReviewDecision,
  retrievalRuns,
  reviewDecisions,
} from "~/db";

export const REVIEW_DECISIONS = [
  "no_issue",
  "incorrect",
  "source_missing",
] as const;

export type ReviewQueueRow = {
  answerRunId: string;
  threadId: string | null;
  messageId: string | null;
  turnIndex: number | null;
  createdAt: string;
  searchCount: number;
  totalHits: number;
  queries: string;
  webFallback: number;
  feedbackId: string | null;
  decision: string | null;
  decidedAt: string | null;
};

export const reviewRepository = {
  async listQueue(
    d1: D1Database,
    options: { limit: number; cursor?: string; decided?: boolean },
  ) {
    const db = createDb(d1);
    const cursorFilter = options.cursor
      ? sql`AND createdAt < ${options.cursor}`
      : sql``;
    const decidedFilter =
      options.decided === undefined
        ? sql``
        : options.decided
          ? sql`AND decision IS NOT NULL`
          : sql`AND decision IS NULL`;

    const rows = await db.all<ReviewQueueRow>(sql`
      WITH runs AS (
        SELECT answer_run_id AS answerRunId,
               MAX(thread_id) AS threadId,
               MAX(message_id) AS messageId,
               MAX(turn_index) AS turnIndex,
               MIN(created_at) AS createdAt,
               COUNT(*) AS searchCount,
               SUM(json_array_length(hits)) AS totalHits,
               json_group_array(query) AS queries
        FROM retrieval_runs
        WHERE answer_run_id IS NOT NULL
        GROUP BY answer_run_id
      ),
      flagged AS (
        SELECT r.*,
          EXISTS(
            SELECT 1 FROM llm_usage u
            WHERE u.thread_id = r.threadId
              AND u.turn_index = r.turnIndex
              AND u.agent = 'web-researcher'
          ) AS webFallback,
          (SELECT f.id FROM message_feedback f
            WHERE f.message_id = r.messageId AND f.rating = 'bad'
            ORDER BY f.created_at DESC LIMIT 1) AS feedbackId,
          (SELECT d.decision FROM review_decisions d
            WHERE d.answer_run_id = r.answerRunId
            ORDER BY d.created_at DESC LIMIT 1) AS decision,
          (SELECT d.created_at FROM review_decisions d
            WHERE d.answer_run_id = r.answerRunId
            ORDER BY d.created_at DESC LIMIT 1) AS decidedAt
        FROM runs r
      )
      SELECT * FROM flagged
      WHERE (totalHits = 0 OR webFallback = 1 OR feedbackId IS NOT NULL)
        ${decidedFilter}
        ${cursorFilter}
      ORDER BY createdAt DESC
      LIMIT ${options.limit + 1}
    `);

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      items,
      hasMore,
      nextCursor: hasMore ? (items.at(-1)?.createdAt ?? null) : null,
    };
  },

  async insertRun(d1: D1Database, values: NewRetrievalRun) {
    const db = createDb(d1);
    await db.insert(retrievalRuns).values(values);
  },

  async linkRunsToMessage(
    d1: D1Database,
    answerRunId: string,
    messageId: string,
  ) {
    const db = createDb(d1);
    await db
      .update(retrievalRuns)
      .set({ messageId })
      .where(
        and(
          eq(retrievalRuns.answerRunId, answerRunId),
          isNull(retrievalRuns.messageId),
        ),
      );
  },

  async listRunsByAnswerRunId(d1: D1Database, answerRunId: string) {
    const db = createDb(d1);
    return await db
      .select()
      .from(retrievalRuns)
      .where(eq(retrievalRuns.answerRunId, answerRunId))
      .orderBy(asc(retrievalRuns.createdAt))
      .all();
  },

  async hasWebFallback(
    d1: D1Database,
    threadId: string,
    turnIndex: number | null,
  ) {
    if (turnIndex === null) return false;
    const db = createDb(d1);
    const row = await db.get<{ found: number }>(sql`
      SELECT EXISTS(
        SELECT 1 FROM llm_usage
        WHERE thread_id = ${threadId}
          AND turn_index = ${turnIndex}
          AND agent = 'web-researcher'
      ) AS found
    `);
    return Boolean(row?.found);
  },

  async findBadFeedbackByMessageId(d1: D1Database, messageId: string) {
    const db = createDb(d1);
    const result = await db
      .select()
      .from(messageFeedback)
      .where(eq(messageFeedback.messageId, messageId))
      .orderBy(desc(messageFeedback.createdAt))
      .all();
    return result;
  },

  async listDecisions(d1: D1Database, answerRunId: string) {
    const db = createDb(d1);
    return await db
      .select()
      .from(reviewDecisions)
      .where(eq(reviewDecisions.answerRunId, answerRunId))
      .orderBy(desc(reviewDecisions.createdAt))
      .all();
  },

  async insertDecision(d1: D1Database, values: NewReviewDecision) {
    const db = createDb(d1);
    return await db.insert(reviewDecisions).values(values).returning().get();
  },

  async deleteRunsByThreadId(d1: D1Database, threadId: string) {
    const db = createDb(d1);
    const where = eq(retrievalRuns.threadId, threadId);
    const row = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(retrievalRuns)
      .where(where)
      .get();
    await db.delete(retrievalRuns).where(where);
    return Number(row?.c ?? 0);
  },

  async deleteDecisionsByThreadId(d1: D1Database, threadId: string) {
    const db = createDb(d1);
    const where = eq(reviewDecisions.threadId, threadId);
    const row = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(reviewDecisions)
      .where(where)
      .get();
    await db.delete(reviewDecisions).where(where);
    return Number(row?.c ?? 0);
  },
};

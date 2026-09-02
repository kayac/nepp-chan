import { count, sql } from "drizzle-orm";

import { createDb, mastraMessages } from "~/db";

type Period = { from: string; to: string };

export const mastraMessageRepository = {
  async countUserMessagesByHour(d1: D1Database, period: Period) {
    const db = createDb(d1);

    return db.all<{ hour: number; count: number }>(sql`
      SELECT CAST(strftime('%H', createdAt, '+9 hours') AS INTEGER) AS hour,
             COUNT(*) AS count
      FROM mastra_messages
      WHERE role = 'user' AND createdAt >= ${period.from} AND createdAt < ${period.to}
      GROUP BY hour
    `);
  },

  async countUserMessagesByWeekday(d1: D1Database, period: Period) {
    const db = createDb(d1);

    return db.all<{ dow: number; count: number }>(sql`
      SELECT CAST(strftime('%w', createdAt, '+9 hours') AS INTEGER) AS dow,
             COUNT(*) AS count
      FROM mastra_messages
      WHERE role = 'user' AND createdAt >= ${period.from} AND createdAt < ${period.to}
      GROUP BY dow
    `);
  },

  async countUserMessagesByDate(d1: D1Database, period: Period) {
    const db = createDb(d1);

    return db.all<{
      date: string;
      conversations: number;
      messages: number;
    }>(sql`
      SELECT strftime('%Y-%m-%d', createdAt, '+9 hours') AS date,
             COUNT(DISTINCT thread_id) AS conversations,
             COUNT(*) AS messages
      FROM mastra_messages
      WHERE role = 'user' AND createdAt >= ${period.from} AND createdAt < ${period.to}
      GROUP BY date
      ORDER BY date
    `);
  },

  async countUserMessagesByPlatform(d1: D1Database, period: Period) {
    const db = createDb(d1);

    return db.all<{ platform: string; count: number }>(sql`
      SELECT CASE WHEN t.resourceId LIKE 'line:%' THEN 'line'
                  WHEN t.resourceId LIKE 'admin:%' THEN 'admin'
                  WHEN t.resourceId LIKE 'widget-%' THEN 'widget'
                  ELSE 'web' END AS platform,
             COUNT(*) AS count
      FROM mastra_messages m
      JOIN mastra_threads t ON m.thread_id = t.id
      WHERE m.role = 'user' AND m.createdAt >= ${period.from} AND m.createdAt < ${period.to}
      GROUP BY platform
    `);
  },

  async countUserMessageTotals(d1: D1Database, period: Period) {
    const db = createDb(d1);

    return db.get<{ conversations: number; messages: number }>(sql`
      SELECT COUNT(DISTINCT thread_id) AS conversations, COUNT(*) AS messages
      FROM mastra_messages
      WHERE role = 'user' AND createdAt >= ${period.from} AND createdAt < ${period.to}
    `);
  },

  async findSpansOfUsedThreads(d1: D1Database, period: Period) {
    const db = createDb(d1);

    return db.all<{
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
    `);
  },

  async countByThread(d1: D1Database) {
    const db = createDb(d1);

    return db
      .select({ threadId: mastraMessages.threadId, count: count() })
      .from(mastraMessages)
      .groupBy(mastraMessages.threadId)
      .all();
  },
};

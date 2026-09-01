import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import {
  createDb,
  type DbClient,
  dataRetentionLogs,
  llmUsage,
  mastraMessages,
  mastraResources,
  mastraThreads,
  messageFeedback,
  pollSubmissions,
  retrievalRuns,
  threadPersonaStatus,
} from "~/db";
import { logger } from "~/lib/logger";
import { getStorage } from "~/lib/storage";

const RETENTION_DAYS = {
  mastra_messages: 30,
  mastra_threads: 30, // 空スレッドへの猶予期間
  mastra_resources: 180,
  message_feedback: 180,
  llm_usage: 180, // 週次レポートに集計が恒久保存されるため raw は短期で良い
  poll_submissions: 365,
  retrieval_runs: 90,
  data_retention_logs: 1095,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DataRetentionResult = {
  table: string;
  deletedCount: number;
};

const cutoff = (now: Date, days: number) =>
  new Date(now.getTime() - days * DAY_MS).toISOString();

const countAndDelete = async (
  db: DbClient,
  table: SQLiteTable,
  where: SQL,
): Promise<number> => {
  const row = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(table)
    .where(where)
    .get();
  const count = Number(row?.c ?? 0);
  if (count > 0) {
    await db.delete(table).where(where);
  }
  return count;
};

export const runDataRetention = async (
  env: CloudflareBindings,
  options: { now?: Date } = {},
): Promise<DataRetentionResult[]> => {
  const now = options.now ?? new Date();
  const executedAt = now.toISOString();
  const db = createDb(env.DB);

  try {
    // Mastra テーブルは drizzle の migration 対象外。未初期化の D1 に対して
    // Cron 起動が最初に届くと "no such table" になるので、テーブルの存在を保証する。
    await getStorage(env.DB);

    const results: DataRetentionResult[] = [];

    results.push({
      table: "mastra_messages",
      deletedCount: await countAndDelete(
        db,
        mastraMessages,
        sql`datetime(${mastraMessages.createdAt}) < datetime(${cutoff(now, RETENTION_DAYS.mastra_messages)})`,
      ),
    });

    // mastra_messages 削除により thread_persona_status.last_message_count が
    // 現実より大きいまま残ると、persona-extractor が新規メッセージを抽出対象外と
    // 判定してしまう。残メッセージ数で再計算して整合性を取る。
    await db.run(sql`
      UPDATE thread_persona_status
      SET last_message_count = COALESCE((
        SELECT COUNT(*) FROM mastra_messages
        WHERE mastra_messages.thread_id = thread_persona_status.thread_id
      ), 0)
    `);

    // 紐づくメッセージが無く、かつ作成から猶予期間を超えたスレッドのみ削除。
    // 新規作成直後の空スレッドが Cron で消えると POST /threads → チャット投稿の間に 404 になる。
    results.push({
      table: "mastra_threads",
      deletedCount: await countAndDelete(
        db,
        mastraThreads,
        sql`${mastraThreads.id} NOT IN (SELECT DISTINCT thread_id FROM mastra_messages)
          AND datetime(${mastraThreads.createdAt}) < datetime(${cutoff(now, RETENTION_DAYS.mastra_threads)})`,
      ),
    });

    results.push({
      table: "thread_persona_status",
      deletedCount: await countAndDelete(
        db,
        threadPersonaStatus,
        sql`${threadPersonaStatus.threadId} NOT IN (SELECT id FROM mastra_threads)`,
      ),
    });

    results.push({
      table: "mastra_resources",
      deletedCount: await countAndDelete(
        db,
        mastraResources,
        sql`datetime(${mastraResources.updatedAt}) < datetime(${cutoff(now, RETENTION_DAYS.mastra_resources)})`,
      ),
    });

    results.push({
      table: "message_feedback",
      deletedCount: await countAndDelete(
        db,
        messageFeedback,
        sql`datetime(${messageFeedback.createdAt}) < datetime(${cutoff(now, RETENTION_DAYS.message_feedback)})`,
      ),
    });

    results.push({
      table: "llm_usage",
      deletedCount: await countAndDelete(
        db,
        llmUsage,
        sql`datetime(${llmUsage.createdAt}) < datetime(${cutoff(now, RETENTION_DAYS.llm_usage)})`,
      ),
    });

    results.push({
      table: "poll_submissions",
      deletedCount: await countAndDelete(
        db,
        pollSubmissions,
        sql`datetime(${pollSubmissions.createdAt}) < datetime(${cutoff(now, RETENTION_DAYS.poll_submissions)})`,
      ),
    });

    results.push({
      table: "retrieval_runs",
      deletedCount: await countAndDelete(
        db,
        retrievalRuns,
        sql`datetime(${retrievalRuns.createdAt}) < datetime(${cutoff(now, RETENTION_DAYS.retrieval_runs)})`,
      ),
    });

    results.push({
      table: "data_retention_logs",
      deletedCount: await countAndDelete(
        db,
        dataRetentionLogs,
        sql`datetime(${dataRetentionLogs.executedAt}) < datetime(${cutoff(now, RETENTION_DAYS.data_retention_logs)})`,
      ),
    });

    for (const r of results) {
      await db.insert(dataRetentionLogs).values({
        id: crypto.randomUUID(),
        executedAt,
        targetTable: r.table,
        deletedCount: r.deletedCount,
        createdAt: executedAt,
      });
    }

    logger.info("data_retention_executed", {
      event: "data_retention_executed",
      ...Object.fromEntries(
        results.map((r) => [`${r.table}_deleted`, r.deletedCount]),
      ),
    });

    return results;
  } catch (error) {
    logger.error("data_retention_failed", error, {
      event: "data_retention_failed",
    });
    throw error;
  }
};

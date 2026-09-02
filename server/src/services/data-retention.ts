import { logger } from "~/lib/logger";
import { getStorage } from "~/lib/storage";
import { dataRetentionLogRepository } from "~/repository/data-retention-log-repository";
import { feedbackRepository } from "~/repository/feedback-repository";
import { llmUsageRepository } from "~/repository/llm-usage-repository";
import { mastraMessageRepository } from "~/repository/mastra-message-repository";
import { mastraResourceRepository } from "~/repository/mastra-resource-repository";
import { mastraThreadRepository } from "~/repository/mastra-thread-repository";
import { pollRepository } from "~/repository/poll-repository";
import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";

const RETENTION_DAYS = {
  mastra_messages: 30,
  mastra_threads: 30, // 空スレッドへの猶予期間
  mastra_resources: 180,
  message_feedback: 180,
  llm_usage: 180, // 週次レポートに集計が恒久保存されるため raw は短期で良い
  poll_submissions: 365,
  data_retention_logs: 1095,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DataRetentionResult = {
  table: string;
  deletedCount: number;
};

const cutoff = (now: Date, days: number) =>
  new Date(now.getTime() - days * DAY_MS).toISOString();

export const runDataRetention = async (
  env: CloudflareBindings,
  options: { now?: Date } = {},
): Promise<DataRetentionResult[]> => {
  const now = options.now ?? new Date();
  const executedAt = now.toISOString();
  const expiredAt = (days: number) => cutoff(now, days);

  try {
    // Mastra テーブルは drizzle の migration 対象外。未初期化の D1 に対して
    // Cron 起動が最初に届くと "no such table" になるので、テーブルの存在を保証する。
    await getStorage(env.DB);

    const results: DataRetentionResult[] = [];

    results.push({
      table: "mastra_messages",
      deletedCount: await mastraMessageRepository.deleteCreatedBefore(
        env.DB,
        expiredAt(RETENTION_DAYS.mastra_messages),
      ),
    });

    // mastra_messages 削除により thread_persona_status.last_message_count が
    // 現実より大きいまま残ると、persona-extractor が新規メッセージを抽出対象外と
    // 判定してしまう。残メッセージ数で再計算して整合性を取る。
    await threadPersonaStatusRepository.syncMessageCounts(env.DB);

    // 紐づくメッセージが無く、かつ作成から猶予期間を超えたスレッドのみ削除。
    // 新規作成直後の空スレッドが Cron で消えると POST /threads → チャット投稿の間に 404 になる。
    results.push({
      table: "mastra_threads",
      deletedCount: await mastraThreadRepository.deleteEmptyCreatedBefore(
        env.DB,
        expiredAt(RETENTION_DAYS.mastra_threads),
      ),
    });

    results.push({
      table: "thread_persona_status",
      deletedCount: await threadPersonaStatusRepository.deleteOrphaned(env.DB),
    });

    results.push({
      table: "mastra_resources",
      deletedCount: await mastraResourceRepository.deleteUpdatedBefore(
        env.DB,
        expiredAt(RETENTION_DAYS.mastra_resources),
      ),
    });

    results.push({
      table: "message_feedback",
      deletedCount: await feedbackRepository.deleteCreatedBefore(
        env.DB,
        expiredAt(RETENTION_DAYS.message_feedback),
      ),
    });

    results.push({
      table: "llm_usage",
      deletedCount: await llmUsageRepository.deleteCreatedBefore(
        env.DB,
        expiredAt(RETENTION_DAYS.llm_usage),
      ),
    });

    results.push({
      table: "poll_submissions",
      deletedCount: await pollRepository.deleteSubmissionsCreatedBefore(
        env.DB,
        expiredAt(RETENTION_DAYS.poll_submissions),
      ),
    });

    results.push({
      table: "data_retention_logs",
      deletedCount: await dataRetentionLogRepository.deleteExecutedBefore(
        env.DB,
        expiredAt(RETENTION_DAYS.data_retention_logs),
      ),
    });

    for (const r of results) {
      await dataRetentionLogRepository.create(env.DB, {
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

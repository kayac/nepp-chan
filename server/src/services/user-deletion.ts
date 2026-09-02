import type { SQL } from "drizzle-orm";
import { eq, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import {
  createDb,
  type DbClient,
  mastraMessages,
  mastraResources,
  mastraThreads,
  messageFeedback,
  pollSubmissions,
  threadPersonaStatus,
  userBroadcastState,
  userPollState,
} from "~/db";
import { hmacSha256 } from "~/lib/crypto";
import { logger } from "~/lib/logger";
import { getStorage } from "~/lib/storage";
import { reviewRepository } from "~/repository/review-repository";

const countAndDelete = async (db: DbClient, table: SQLiteTable, where: SQL) => {
  const row = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(table)
    .where(where)
    .get();
  await db.delete(table).where(where);
  return Number(row?.c ?? 0);
};

export const deleteAllByLineUserId = async (
  env: CloudflareBindings,
  userId: string,
) => {
  const hashedUserId = await hmacSha256(userId, env.RESOURCE_ID_HASH_SECRET);
  const lineThreadId = `line-thread:${hashedUserId}`;
  const lineResourceId = `line:${hashedUserId}`;

  const db = createDb(env.DB);

  try {
    // Mastra テーブルは drizzle の migration 対象外（tablesFilter で除外）。
    // 未初期化の D1 に対して unfollow が最初に届くと "no such table" になるため、
    // D1Store.init() を経由してテーブルの存在を保証する。
    await getStorage(env.DB);

    const mastraMessagesDeleted = await countAndDelete(
      db,
      mastraMessages,
      eq(mastraMessages.threadId, lineThreadId),
    );
    const messageFeedbackDeleted = await countAndDelete(
      db,
      messageFeedback,
      eq(messageFeedback.threadId, lineThreadId),
    );
    const threadPersonaStatusDeleted = await countAndDelete(
      db,
      threadPersonaStatus,
      eq(threadPersonaStatus.threadId, lineThreadId),
    );
    const mastraThreadsDeleted = await countAndDelete(
      db,
      mastraThreads,
      eq(mastraThreads.id, lineThreadId),
    );
    const mastraResourcesDeleted = await countAndDelete(
      db,
      mastraResources,
      eq(mastraResources.id, lineResourceId),
    );
    const pollSubmissionsDeleted = await countAndDelete(
      db,
      pollSubmissions,
      eq(pollSubmissions.userId, hashedUserId),
    );
    const userBroadcastStateDeleted = await countAndDelete(
      db,
      userBroadcastState,
      eq(userBroadcastState.userId, hashedUserId),
    );
    const userPollStateDeleted = await countAndDelete(
      db,
      userPollState,
      eq(userPollState.userId, hashedUserId),
    );
    const retrievalRunsDeleted = await reviewRepository.deleteRunsByThreadId(
      env.DB,
      lineThreadId,
    );
    const reviewDecisionsDeleted =
      await reviewRepository.deleteDecisionsByThreadId(env.DB, lineThreadId);

    logger.info("user_data_deleted", {
      event: "user_data_deleted",
      retrieval_runs_deleted: retrievalRunsDeleted,
      review_decisions_deleted: reviewDecisionsDeleted,
      mastra_threads_deleted: mastraThreadsDeleted,
      mastra_messages_deleted: mastraMessagesDeleted,
      mastra_resources_deleted: mastraResourcesDeleted,
      thread_persona_status_deleted: threadPersonaStatusDeleted,
      message_feedback_deleted: messageFeedbackDeleted,
      poll_submissions_deleted: pollSubmissionsDeleted,
      user_broadcast_state_deleted: userBroadcastStateDeleted,
      user_poll_state_deleted: userPollStateDeleted,
    });
  } catch (error) {
    logger.error("user_data_deletion_failed", error, {
      event: "user_data_deletion_failed",
    });
    throw error;
  }
};

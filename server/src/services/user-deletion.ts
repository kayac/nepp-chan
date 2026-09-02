import { hmacSha256 } from "~/lib/crypto";
import { logger } from "~/lib/logger";
import { getStorage } from "~/lib/storage";
import { feedbackRepository } from "~/repository/feedback-repository";
import { mastraMessageRepository } from "~/repository/mastra-message-repository";
import { mastraResourceRepository } from "~/repository/mastra-resource-repository";
import { mastraThreadRepository } from "~/repository/mastra-thread-repository";
import { pollRepository } from "~/repository/poll-repository";
import { reviewRepository } from "~/repository/review-repository";
import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";
import { userBroadcastStateRepository } from "~/repository/user-broadcast-state-repository";
import { userPollStateRepository } from "~/repository/user-poll-state-repository";

export const deleteAllByLineUserId = async (
  env: CloudflareBindings,
  userId: string,
) => {
  const hashedUserId = await hmacSha256(userId, env.RESOURCE_ID_HASH_SECRET);
  const lineThreadId = `line-thread:${hashedUserId}`;
  const lineResourceId = `line:${hashedUserId}`;

  try {
    // Mastra テーブルは drizzle の migration 対象外（tablesFilter で除外）。
    // 未初期化の D1 に対して unfollow が最初に届くと "no such table" になるため、
    // D1Store.init() を経由してテーブルの存在を保証する。
    await getStorage(env.DB);

    const mastraMessagesDeleted =
      await mastraMessageRepository.deleteByThreadId(env.DB, lineThreadId);
    const messageFeedbackDeleted = await feedbackRepository.deleteByThreadId(
      env.DB,
      lineThreadId,
    );
    const threadPersonaStatusDeleted =
      await threadPersonaStatusRepository.delete(env.DB, lineThreadId);
    const mastraThreadsDeleted = await mastraThreadRepository.deleteById(
      env.DB,
      lineThreadId,
    );
    const mastraResourcesDeleted = await mastraResourceRepository.deleteById(
      env.DB,
      lineResourceId,
    );
    const pollSubmissionsDeleted =
      await pollRepository.deleteSubmissionsByUserId(env.DB, hashedUserId);
    const userBroadcastStateDeleted =
      await userBroadcastStateRepository.deleteByUserId(env.DB, hashedUserId);
    const userPollStateDeleted = await userPollStateRepository.deleteByUserId(
      env.DB,
      hashedUserId,
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

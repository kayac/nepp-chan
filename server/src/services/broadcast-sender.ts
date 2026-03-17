import { logger } from "~/lib/logger";
import { broadcastRepository } from "~/repository/broadcast-repository";
import { createLineClient } from "~/services/line-messaging";

export const sendBroadcast = async (
  env: CloudflareBindings,
  broadcastId: string,
): Promise<{ success: boolean; error?: string }> => {
  const broadcast = await broadcastRepository.findById(env.DB, broadcastId);

  if (!broadcast) {
    return { success: false, error: "配信メッセージが見つかりません" };
  }

  if (broadcast.status === "sent") {
    return { success: false, error: "既に送信済みです" };
  }

  try {
    const client = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN);
    const retryKey = crypto.randomUUID();

    await client.broadcast(
      {
        messages: [
          {
            type: "text",
            text: broadcast.body,
          },
        ],
      },
      retryKey,
    );

    await broadcastRepository.markSent(env.DB, broadcastId);

    logger.info(`[Broadcast] Sent successfully: ${broadcastId}`);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error(`[Broadcast] Failed to send: ${broadcastId}`, error);
    await broadcastRepository.markFailed(env.DB, broadcastId, errorMessage);

    return { success: false, error: errorMessage };
  }
};

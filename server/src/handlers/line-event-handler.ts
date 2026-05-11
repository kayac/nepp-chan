import { logger } from "~/lib/logger";
import type { LinePrincipal } from "~/lib/principal";
import { toLineResourceId, toLineThreadId } from "~/lib/principal";
import type { LineEventMessage } from "~/schemas/line-schema";
import {
  createLineClient,
  generateReply,
  sendLineMessages,
} from "~/services/line-messaging";

export const handleLineEvent = async (
  batch: MessageBatch<LineEventMessage>,
  env: CloudflareBindings,
) => {
  const client = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN);
  const secret = env.RESOURCE_ID_HASH_SECRET;

  for (const message of batch.messages) {
    const { userId, userMessage, replyToken } = message.body;

    try {
      const principal: LinePrincipal = { type: "line", id: userId };
      const [resourceId, threadId] = await Promise.all([
        toLineResourceId(principal, secret),
        toLineThreadId(principal, secret),
      ]);
      const replyTexts = await generateReply({
        userMessage,
        userId,
        resourceId,
        threadId,
        env,
      });

      if (replyTexts.length > 0) {
        await sendLineMessages({
          client,
          replyToken,
          userId,
          texts: replyTexts,
        });
      }

      message.ack();
    } catch (error) {
      logger.error(`LINE reply failed for user ${userId}`, error);
      message.retry();
    }
  }
};

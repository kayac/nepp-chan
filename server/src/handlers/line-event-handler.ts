import * as Sentry from "@sentry/cloudflare";
import { logger } from "~/lib/logger";
import type { LinePrincipal } from "~/lib/principal";
import { toResourceId } from "~/lib/principal";
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

  for (const message of batch.messages) {
    const { userId, userMessage, replyToken } = message.body;

    try {
      const principal: LinePrincipal = { type: "line", id: userId };
      const replyTexts = await generateReply({
        userMessage,
        resourceId: toResourceId(principal),
        threadId: `line-thread:${userId}`,
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
      Sentry.captureException(error, { tags: { handler: "line-event" } });
      logger.error(`LINE reply failed for user ${userId}`, error);
      message.retry();
    }
  }
};

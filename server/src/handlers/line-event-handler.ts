import * as Sentry from "@sentry/cloudflare";
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
      const replyTexts = await generateReply({
        userMessage,
        resourceId: `line:${userId}`,
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
      console.error(`LINE reply failed for user ${userId}:`, error);
      message.retry();
    }
  }
};

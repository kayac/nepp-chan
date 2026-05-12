import { logger } from "~/lib/logger";
import type { LinePrincipal } from "~/lib/principal";
import { toLineResourceId, toLineThreadId } from "~/lib/principal";
import type { LineEventMessage } from "~/schemas/line-schema";
import {
  createLineClient,
  generateReply,
  sendLineMessages,
} from "~/services/line-messaging";
import { deleteAllByLineUserId } from "~/services/user-deletion";

export const handleLineEvent = async (
  batch: MessageBatch<LineEventMessage>,
  env: CloudflareBindings,
) => {
  const client = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN);
  const secret = env.RESOURCE_ID_HASH_SECRET;

  for (const message of batch.messages) {
    const body = message.body;

    if (body.type === "unfollow") {
      try {
        await deleteAllByLineUserId(env, body.userId);
        message.ack();
      } catch (error) {
        logger.error("LINE unfollow deletion failed", error);
        message.retry();
      }
      continue;
    }

    let threadId: string | undefined;
    try {
      const { userId, userMessage, replyToken } = body;
      const principal: LinePrincipal = { type: "line", id: userId };
      const [resourceId, hashedThreadId] = await Promise.all([
        toLineResourceId(principal, secret),
        toLineThreadId(principal, secret),
      ]);
      threadId = hashedThreadId;
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
          threadId,
          texts: replyTexts,
        });
      }

      message.ack();
    } catch (error) {
      logger.error(
        "LINE reply failed",
        error,
        threadId ? { threadId } : undefined,
      );
      message.retry();
    }
  }
};

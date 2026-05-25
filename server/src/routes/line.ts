import { OpenAPIHono } from "@hono/zod-openapi";
import type { webhook } from "@line/bot-sdk";

import { logger } from "~/lib/logger";
import { lineSignatureVerify } from "~/middleware";
import type { LineEventMessage } from "~/schemas/line-schema";
import {
  generateBroadcastExplanation,
  handleBroadcastPostback,
} from "~/services/broadcast-response";
import {
  generatePollFollowUp,
  handlePollPostback,
} from "~/services/poll-response";

export const lineRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { parsedBody: unknown };
}>();

lineRoutes.use("/*", lineSignatureVerify);

lineRoutes.post("/webhook", async (c) => {
  const body = c.get("parsedBody") as webhook.CallbackRequest;
  const eventCount = body.events?.length ?? 0;
  logger.info(`[LINE] webhook received`, { eventCount });

  if (!body.events || eventCount === 0) {
    return c.json({ status: "ok" });
  }

  await enqueueLineEvents(body.events, c.env, c.executionCtx);

  return c.json({ status: "ok" });
});

const enqueueLineEvents = async (
  events: webhook.Event[],
  env: CloudflareBindings,
  executionCtx: { waitUntil: (promise: Promise<unknown>) => void },
) => {
  for (const event of events) {
    if (event.type === "postback") {
      if (!event.source?.userId || !event.replyToken) continue;
      const userId = event.source.userId;
      const postbackData = event.postback.data;

      if (postbackData.startsWith("poll=")) {
        try {
          const result = await handlePollPostback(
            env,
            userId,
            postbackData,
            event.replyToken,
          );

          if (result.status === "answered") {
            executionCtx.waitUntil(
              generatePollFollowUp(
                env,
                userId,
                result.poll,
                result.selectedChoice,
              ),
            );
          }
        } catch (error) {
          logger.error("[LINE] Poll postback error", error);
        }
        continue;
      }

      if (postbackData.startsWith("broadcast=")) {
        try {
          const result = await handleBroadcastPostback(
            env,
            postbackData,
            event.replyToken,
          );

          if (result.status === "accepted") {
            executionCtx.waitUntil(
              generateBroadcastExplanation(
                env,
                userId,
                result.broadcast,
                result.replyToken,
              ),
            );
          }
        } catch (error) {
          logger.error("[LINE] Broadcast postback error", error);
        }
        continue;
      }

      continue;
    }

    if (event.type === "unfollow") {
      if (!event.source?.userId) continue;
      const unfollow: LineEventMessage = {
        type: "unfollow",
        userId: event.source.userId,
      };
      await env.LINE_QUEUE.send(unfollow);
      continue;
    }

    if (event.type !== "message") continue;
    if (!("replyToken" in event) || !event.replyToken) continue;
    if (!event.source?.userId) continue;

    if (event.message.type === "text") {
      const message: LineEventMessage = {
        type: "message",
        userId: event.source.userId,
        userMessage: event.message.text,
        replyToken: event.replyToken,
      };
      await env.LINE_QUEUE.send(message);
      continue;
    }

    if (event.message.type === "sticker") {
      const sticker: LineEventMessage = {
        type: "sticker",
        userId: event.source.userId,
        replyToken: event.replyToken,
      };
      await env.LINE_QUEUE.send(sticker);
    }
  }
};

import { OpenAPIHono } from "@hono/zod-openapi";
import type { WebhookEvent, WebhookRequestBody } from "@line/bot-sdk";

import { logger } from "~/lib/logger";
import { lineSignatureVerify } from "~/middleware";
import type { LineEventMessage } from "~/schemas/line-schema";
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
  const body = c.get("parsedBody") as WebhookRequestBody;
  const eventCount = body.events?.length ?? 0;
  logger.info(`[LINE] webhook received`, { eventCount });

  if (!body.events || eventCount === 0) {
    return c.json({ status: "ok" });
  }

  await enqueueLineEvents(body.events, c.env, c.executionCtx);

  return c.json({ status: "ok" });
});

const enqueueLineEvents = async (
  events: WebhookEvent[],
  env: CloudflareBindings,
  executionCtx: { waitUntil: (promise: Promise<unknown>) => void },
) => {
  for (const event of events) {
    if (event.type === "postback") {
      if (!event.source.userId || !event.replyToken) continue;
      if (!event.postback.data.startsWith("poll=")) continue;

      try {
        const result = await handlePollPostback(
          env,
          event.source.userId,
          event.postback.data,
          event.replyToken,
        );

        if (result.status === "answered") {
          const userId = event.source.userId;
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

    if (event.type !== "message" || event.message.type !== "text") continue;
    if (!("replyToken" in event) || !event.replyToken) continue;
    if (!event.source.userId) continue;

    const message: LineEventMessage = {
      userId: event.source.userId,
      userMessage: event.message.text,
      replyToken: event.replyToken,
    };

    await env.LINE_QUEUE.send(message);
  }
};

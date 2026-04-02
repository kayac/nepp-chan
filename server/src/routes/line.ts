import { OpenAPIHono } from "@hono/zod-openapi";
import type { WebhookEvent, WebhookRequestBody } from "@line/bot-sdk";

import { logger } from "~/lib/logger";
import { lineSignatureVerify } from "~/middleware";
import type { LineEventMessage } from "~/schemas/line-schema";
import { handleQuestionnairePostback } from "~/services/questionnaire-response";

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

  await enqueueLineEvents(body.events, c.env);

  return c.json({ status: "ok" });
});

const enqueueLineEvents = async (
  events: WebhookEvent[],
  env: CloudflareBindings,
) => {
  for (const event of events) {
    // Postback イベント（アンケート回答）
    if (event.type === "postback") {
      if (!event.source.userId || !event.replyToken) continue;
      if (!event.postback.data.startsWith("qnr=")) continue;

      try {
        await handleQuestionnairePostback(
          env,
          event.source.userId,
          event.postback.data,
          event.replyToken,
        );
      } catch (error) {
        logger.error("[LINE] Questionnaire postback error", error);
      }
      continue;
    }

    // Message イベント（既存のチャット処理）
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

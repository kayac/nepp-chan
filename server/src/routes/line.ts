import { OpenAPIHono } from "@hono/zod-openapi";
import type { WebhookEvent, WebhookRequestBody } from "@line/bot-sdk";

import type { LineEventMessage } from "~/handlers/line-event-handler";
import { lineSignatureVerify } from "~/middleware";

export const lineRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { parsedBody: unknown };
}>();

lineRoutes.use("/*", lineSignatureVerify);

lineRoutes.post("/webhook", async (c) => {
  const body = c.get("parsedBody") as WebhookRequestBody;

  if (!body.events || body.events.length === 0) {
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

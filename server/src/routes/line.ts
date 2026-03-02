import { OpenAPIHono } from "@hono/zod-openapi";
import type { WebhookEvent, WebhookRequestBody } from "@line/bot-sdk";
import { messagingApi } from "@line/bot-sdk";
import { Mastra } from "@mastra/core/mastra";

import { getStorage } from "~/lib/storage";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";
import { lineSignatureVerify } from "~/middleware";

const LINE_MAX_MESSAGES = 5;
const LINE_MAX_CHARS = 5000;

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

  c.executionCtx.waitUntil(handleLineEvents(body.events, c.env));

  return c.json({ status: "ok" });
});

const handleLineEvents = async (
  events: WebhookEvent[],
  env: CloudflareBindings,
) => {
  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
  });

  for (const event of events) {
    if (event.type !== "message" || event.message.type !== "text") continue;
    if (!("replyToken" in event) || !event.replyToken) continue;
    if (!event.source.userId) continue;

    const userId = event.source.userId;
    const resourceId = `line:${userId}`;
    const threadId = `line-thread:${userId}`;
    const userMessage = event.message.text;

    try {
      const replyTexts = await generateReply({
        userMessage,
        resourceId,
        threadId,
        env,
      });

      if (replyTexts.length === 0) continue;

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: replyTexts.map((text) => ({ type: "text", text })),
      });
    } catch (error) {
      console.error(`LINE reply failed for user ${userId}:`, error);
    }
  }
};

const generateReply = async (params: {
  userMessage: string;
  resourceId: string;
  threadId: string;
  env: CloudflareBindings;
}): Promise<string[]> => {
  const storage = await getStorage(params.env.DB);

  const requestContext = createRequestContext({
    storage,
    db: params.env.DB,
    env: params.env,
  });

  const neppChanAgent = createNeppChanAgent({ channel: "line" });
  const mastra = new Mastra({
    agents: { neppChanAgent },
    storage,
  });
  const agent = mastra.getAgent("neppChanAgent");

  const response = await agent.generate(params.userMessage, {
    requestContext,
    memory: {
      resource: params.resourceId,
      thread: params.threadId,
    },
  });

  const texts = extractReplyTexts(response.steps ?? []);

  if (texts.length === 0 && response.text) {
    return splitMessage(response.text);
  }

  return texts;
};

const extractReplyTexts = (steps: Array<{ text: string }>): string[] => {
  const messages: string[] = [];

  for (const step of steps) {
    if (!step.text || step.text.trim().length === 0) continue;

    if (step.text.length <= LINE_MAX_CHARS) {
      messages.push(step.text);
    } else {
      for (let i = 0; i < step.text.length; i += LINE_MAX_CHARS) {
        messages.push(step.text.slice(i, i + LINE_MAX_CHARS));
        if (messages.length >= LINE_MAX_MESSAGES) break;
      }
    }

    if (messages.length >= LINE_MAX_MESSAGES) break;
  }

  return messages.slice(0, LINE_MAX_MESSAGES);
};

const splitMessage = (text: string): string[] => {
  if (text.length <= LINE_MAX_CHARS) return [text];
  const messages: string[] = [];
  for (
    let i = 0;
    i < text.length && messages.length < LINE_MAX_MESSAGES;
    i += LINE_MAX_CHARS
  ) {
    messages.push(text.slice(i, i + LINE_MAX_CHARS));
  }
  return messages;
};

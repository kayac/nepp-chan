import { messagingApi } from "@line/bot-sdk";
import { Mastra } from "@mastra/core/mastra";

import { getStorage } from "~/lib/storage";
import { stripMarkdown } from "~/lib/strip-markdown";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";

const LINE_MAX_MESSAGES = 5;
const LINE_MAX_CHARS = 5000;

export type LineEventMessage = {
  userId: string;
  userMessage: string;
  replyToken: string;
};

export const handleLineEvent = async (
  batch: MessageBatch<LineEventMessage>,
  env: CloudflareBindings,
) => {
  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
  });

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
        const messages = replyTexts.map((text) => ({
          type: "text" as const,
          text,
        }));
        await client
          .replyMessage({ replyToken, messages })
          .then(() => console.log(`LINE replyMessage sent to ${userId}`))
          .catch(async () => {
            await client.pushMessage({ to: userId, messages });
            console.log(`LINE pushMessage sent to ${userId}`);
          });
      }

      message.ack();
    } catch (error) {
      console.error(`LINE reply failed for user ${userId}:`, error);
      message.retry();
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
    return splitMessage(response.text).map(stripMarkdown);
  }

  return texts.map(stripMarkdown);
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

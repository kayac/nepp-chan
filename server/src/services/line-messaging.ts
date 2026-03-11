import { messagingApi } from "@line/bot-sdk";
import { Mastra } from "@mastra/core/mastra";

import { splitMessagesForLine } from "~/lib/split-message";
import { getStorage } from "~/lib/storage";
import { stripMarkdown } from "~/lib/strip-markdown";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";

export const createLineClient = (token: string) =>
  new messagingApi.MessagingApiClient({ channelAccessToken: token });

export const generateReply = async (params: {
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

  const neppChanAgent = createNeppChanAgent({ platform: "line" });
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

  const stepTexts = (response.steps ?? []).map((step) => step.text);
  const texts = splitMessagesForLine(stepTexts);

  if (texts.length === 0 && response.text) {
    return splitMessagesForLine([response.text]).map(stripMarkdown);
  }

  return texts.map(stripMarkdown);
};

export const sendLineMessages = async (params: {
  client: messagingApi.MessagingApiClient;
  replyToken: string;
  userId: string;
  texts: string[];
}) => {
  const messages = params.texts.map((text) => ({
    type: "text" as const,
    text,
  }));

  try {
    await params.client.replyMessage({
      replyToken: params.replyToken,
      messages,
    });
    console.log(`LINE replyMessage sent to ${params.userId}`);
  } catch (replyError) {
    console.log(
      `LINE replyMessage failed for ${params.userId}, falling back to pushMessage:`,
      replyError,
    );
    await params.client.pushMessage({ to: params.userId, messages });
    console.log(`LINE pushMessage sent to ${params.userId}`);
  }
};

import { messagingApi } from "@line/bot-sdk";
import { Mastra } from "@mastra/core/mastra";
import { classifyIntent } from "~/lib/classify-intent";
import { resolveModelTier } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { splitMessagesForLine } from "~/lib/split-message";
import { getStorage } from "~/lib/storage";
import { stripMarkdown } from "~/lib/strip-markdown";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";
import { injectBroadcastsToThread } from "~/services/broadcast-thread-injector";
import { injectPollsToThread } from "~/services/poll-thread-injector";

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

  // 未注入の配信メッセージ／投票お知らせをスレッドに system として追加
  const lineUserId = params.threadId.replace("line-thread:", "");
  await Promise.all([
    injectBroadcastsToThread({
      d1: params.env.DB,
      storage,
      threadId: params.threadId,
      resourceId: params.resourceId,
      userId: lineUserId,
    }),
    injectPollsToThread({
      d1: params.env.DB,
      storage,
      threadId: params.threadId,
      resourceId: params.resourceId,
      userId: lineUserId,
    }),
  ]);

  // Intent 分類でモデルティアを決定（非テキストメッセージは casual 直行）
  const intent = params.userMessage
    ? await classifyIntent(params.userMessage)
    : "casual";
  const modelConfig = resolveModelTier({
    intent,
    platform: "line",
    isAdmin: false,
  });
  logger.info(`[LINE] intent: ${intent}`, { threadId: params.threadId });

  const neppChanAgent = createNeppChanAgent({
    platform: "line",
    modelConfig,
  });
  const mastra = new Mastra({
    agents: { neppChanAgent },
    storage,
  });
  const agent = mastra.getAgent("neppChanAgent");
  logger.info(`[LINE] generating reply`, { threadId: params.threadId });

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
    logger.warn(`[LINE] step texts empty, using fallback`, {
      threadId: params.threadId,
    });
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
    logger.info(`LINE replyMessage sent to ${params.userId}`);
  } catch {
    logger.warn(
      `LINE replyMessage failed for ${params.userId}, falling back to pushMessage`,
    );
    await params.client.pushMessage({ to: params.userId, messages });
    logger.info(`LINE pushMessage sent to ${params.userId}`);
  }
};

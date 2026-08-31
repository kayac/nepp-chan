import { messagingApi } from "@line/bot-sdk";
import { Mastra } from "@mastra/core/mastra";
import { classifyIntent } from "~/lib/classify-intent";
import { primaryModelId, resolveModelTier } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { splitMessagesForLine } from "~/lib/split-message";
import { getStorage } from "~/lib/storage";
import { stripMarkdown } from "~/lib/strip-markdown";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";
import { nextTurnIndex, recordLlmUsage } from "~/services/analytics/llm-usage";
import { injectBroadcastsToThread } from "~/services/broadcast-thread-injector";
import { injectPollsToThread } from "~/services/poll-thread-injector";

export const createLineClient = (token: string) =>
  new messagingApi.MessagingApiClient({ channelAccessToken: token });

export const generateReply = async (params: {
  client: messagingApi.MessagingApiClient;
  userMessage: string;
  userId: string;
  hashedUserId: string;
  resourceId: string;
  threadId: string;
  env: CloudflareBindings;
}) => {
  const storage = await getStorage(params.env.DB);
  const turnIndex = await nextTurnIndex(params.env.DB, params.threadId);
  const startedAt = Date.now();

  const requestContext = createRequestContext({
    storage,
    db: params.env.DB,
    env: params.env,
    usagePlatform: "line",
    usageThreadId: params.threadId,
    usageTurnIndex: turnIndex,
  });

  params.client
    .showLoadingAnimation({
      chatId: params.userId,
      loadingSeconds: 60,
    })
    .catch((error) =>
      logger.warn("[LINE] showLoadingAnimation failed", {
        threadId: params.threadId,
        errorName: error instanceof Error ? error.name : "unknown",
      }),
    );

  await Promise.all([
    injectBroadcastsToThread({
      d1: params.env.DB,
      storage,
      threadId: params.threadId,
      resourceId: params.resourceId,
      userId: params.hashedUserId,
    }),
    injectPollsToThread({
      d1: params.env.DB,
      storage,
      threadId: params.threadId,
      resourceId: params.resourceId,
      userId: params.hashedUserId,
    }),
  ]);

  // Intent 分類でモデルティアを決定（非テキストメッセージは casual 直行）
  const intent = params.userMessage
    ? await classifyIntent(params.userMessage, requestContext)
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
    intent,
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

  await recordLlmUsage(params.env.DB, {
    // フォールバック発火時も実際に応答したモデルで記録する
    model: response.response?.modelId ?? primaryModelId(modelConfig),
    usage: response.totalUsage,
    platform: "line",
    source: "chat",
    agent: "nepp-chan",
    intent,
    threadId: params.threadId,
    turnIndex,
    durationMs: Date.now() - startedAt,
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
  threadId: string;
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
    logger.info("[LINE] replyMessage sent", { threadId: params.threadId });
  } catch (error) {
    logger.warn("[LINE] replyMessage failed, falling back to pushMessage", {
      threadId: params.threadId,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    await params.client.pushMessage({ to: params.userId, messages });
    logger.info("[LINE] pushMessage sent", { threadId: params.threadId });
  }
};

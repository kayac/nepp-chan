import { logger } from "~/lib/logger";
import { toResourceId } from "~/lib/principal";
import {
  createLineClient,
  generateReply,
  sendLineMessages,
} from "~/services/line-messaging";

const TOPICS = [
  "暮らしの何気ない話（天気・季節・近況）",
  "村のお知らせや行事の話題",
  "村の歴史・地名・豆知識",
  "村民への気軽な問いかけ",
  "ねっぷちゃんの最近の出来事",
] as const;

const pickRandomTopic = () => TOPICS[Math.floor(Math.random() * TOPICS.length)];

export const handleChitchatTrigger = async (
  env: CloudflareBindings,
  userId: string,
  replyToken: string,
) => {
  try {
    const topic = pickRandomTopic();
    const userMessage = `（雑談ボタン）村民の話し相手として、「${topic}」をテーマに、観光案内ではなく村に住んでいる人との何気ない雑談として気軽に話題を振って。`;

    const threadId = `line-thread:${userId}`;
    const resourceId = toResourceId({ type: "line", id: userId });

    const replyTexts = await generateReply({
      userMessage,
      resourceId,
      threadId,
      env,
    });

    if (replyTexts.length === 0) return;

    const client = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN);
    await sendLineMessages({
      client,
      replyToken,
      userId,
      texts: replyTexts,
    });
  } catch (error) {
    logger.error("[LINE] Chitchat trigger failed", error);
  }
};

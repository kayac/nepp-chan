import { logger } from "~/lib/logger";
import { toResourceId } from "~/lib/principal";
import {
  type BroadcastMessage,
  broadcastRepository,
} from "~/repository/broadcast-repository";
import type { BroadcastPart } from "~/schemas/broadcast-schema";
import {
  createLineClient,
  generateReply,
  sendLineMessages,
} from "~/services/line-messaging";

const decodeBroadcastPostback = (data: string) => {
  const params = new URLSearchParams(data);
  return { broadcastId: params.get("broadcast") };
};

const extractBodyText = (broadcast: BroadcastMessage): string => {
  if (!broadcast.parts) return broadcast.body;
  try {
    const parts = JSON.parse(broadcast.parts) as BroadcastPart[];
    const texts = parts
      .filter(
        (p): p is Extract<BroadcastPart, { type: "text" }> => p.type === "text",
      )
      .map((p) => p.text);
    return texts.join("\n\n") || broadcast.body;
  } catch {
    return broadcast.body;
  }
};

export type BroadcastExplainResult =
  | { status: "accepted"; broadcast: BroadcastMessage; replyToken: string }
  | { status: "invalid" };

export const handleBroadcastPostback = async (
  env: CloudflareBindings,
  data: string,
  replyToken: string,
): Promise<BroadcastExplainResult> => {
  const { broadcastId } = decodeBroadcastPostback(data);
  if (!broadcastId) return { status: "invalid" };

  const broadcast = await broadcastRepository.findById(env.DB, broadcastId);
  if (!broadcast) return { status: "invalid" };

  return { status: "accepted", broadcast, replyToken };
};

export const generateBroadcastExplanation = async (
  env: CloudflareBindings,
  userId: string,
  broadcast: BroadcastMessage,
  replyToken: string,
) => {
  try {
    const threadId = `line-thread:${userId}`;
    const resourceId = toResourceId({ type: "line", id: userId });

    const bodyText = extractBodyText(broadcast);
    const userMessage = `（おしらせ解説リクエスト）「${broadcast.title}」のおしらせについて、ねっぷちゃんの視点でやさしく解説して！

【おしらせ本文】
${bodyText}`;

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
    logger.error("[Broadcast] Explanation failed", error);
  }
};

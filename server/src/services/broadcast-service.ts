import type { messagingApi } from "@line/bot-sdk";

import type { BroadcastMessage } from "~/db";
import { logger } from "~/lib/logger";
import { broadcastRepository } from "~/repository/broadcast-repository";
import type { BroadcastPart } from "~/schemas/broadcast-schema";
import { createLineClient } from "~/services/line-messaging";

const generateTitle = (text: string) =>
  text.slice(0, 50) + (text.length > 50 ? "…" : "");

const generateBodyFromParts = (parts: BroadcastPart[]): string => {
  const firstText = parts.find((p) => p.type === "text");
  return firstText ? firstText.text : "";
};

const getPublicImageUrl = (env: CloudflareBindings, r2Key: string): string => {
  const apiBaseUrl =
    (env.ENVIRONMENT as string) === "local"
      ? "http://localhost:8787"
      : env.WEB_URL.replace("-web.", "-api.").replace("//web.", "//api.");
  return `${apiBaseUrl}/broadcast/media/${r2Key}`;
};

const buildExplainButtonMessage = (
  broadcastId: string,
): messagingApi.FlexMessage => {
  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "postback",
            label: "ねっぷちゃんに解説してもらう",
            data: `broadcast=${broadcastId}`,
            displayText: "このおしらせ、ねっぷちゃんに解説してもらう！",
          },
          style: "primary",
          color: "#0f766e",
          height: "sm",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: "このおしらせ、ねっぷちゃんに解説してもらう？",
    contents: bubble,
  };
};

const buildLineMessages = (
  parts: BroadcastPart[],
  env: CloudflareBindings,
  broadcastId?: string,
): messagingApi.Message[] => {
  const contentMessages: messagingApi.Message[] = parts.map((part) => {
    if (part.type === "text") {
      return { type: "text" as const, text: part.text };
    }
    const imageUrl = getPublicImageUrl(env, part.imageR2Key);
    return {
      type: "image" as const,
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    };
  });

  if (!broadcastId) return contentMessages;
  return [...contentMessages, buildExplainButtonMessage(broadcastId)];
};

const parseParts = (broadcast: BroadcastMessage): BroadcastPart[] =>
  broadcast.parts
    ? (JSON.parse(broadcast.parts) as BroadcastPart[])
    : [{ type: "text", text: broadcast.body }];

type CreateInput = {
  parts: BroadcastPart[];
  scheduledAt?: string;
  sendNow?: boolean;
  createdBy: string;
};

export const createBroadcastMessage = async (
  env: CloudflareBindings,
  input: CreateInput,
): Promise<BroadcastMessage> => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = input.sendNow
    ? "draft"
    : input.scheduledAt
      ? "scheduled"
      : "draft";

  const body = generateBodyFromParts(input.parts);

  await broadcastRepository.create(env.DB, {
    id,
    title: generateTitle(body),
    body,
    parts: JSON.stringify(input.parts),
    status,
    scheduledAt: input.scheduledAt ?? null,
    createdBy: input.createdBy,
    createdAt: now,
  });

  if (input.sendNow) {
    const result = await sendBroadcast(env, id);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  const broadcast = await broadcastRepository.findById(env.DB, id);
  return broadcast as BroadcastMessage;
};

type UpdateInput = {
  parts?: BroadcastPart[];
  scheduledAt?: string | null;
};

export const updateBroadcastMessage = async (
  db: D1Database,
  id: string,
  input: UpdateInput,
): Promise<BroadcastMessage> => {
  const updateData: {
    title?: string;
    body?: string;
    parts?: string;
    scheduledAt?: string | null;
    status?: string;
  } = {};

  if (input.parts !== undefined) {
    const body = generateBodyFromParts(input.parts);
    updateData.body = body;
    updateData.title = generateTitle(body);
    updateData.parts = JSON.stringify(input.parts);
  }
  if (input.scheduledAt !== undefined) {
    updateData.scheduledAt = input.scheduledAt;
    updateData.status = input.scheduledAt ? "scheduled" : "draft";
  }

  await broadcastRepository.update(db, id, updateData);

  const updated = await broadcastRepository.findById(db, id);
  return updated as BroadcastMessage;
};

export const sendBroadcast = async (
  env: CloudflareBindings,
  broadcastId: string,
): Promise<{ success: boolean; error?: string }> => {
  const broadcast = await broadcastRepository.findById(env.DB, broadcastId);

  if (!broadcast) {
    return { success: false, error: "配信メッセージが見つかりません" };
  }

  if (broadcast.status === "sent") {
    return { success: false, error: "既に送信済みです" };
  }

  try {
    const client = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN);
    const retryKey = crypto.randomUUID();
    const parts = parseParts(broadcast);
    const messages = buildLineMessages(parts, env, broadcast.id);

    await client.broadcast({ messages }, retryKey);

    await broadcastRepository.markSent(env.DB, broadcastId);

    logger.info(`[Broadcast] Sent successfully: ${broadcastId}`);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error(`[Broadcast] Failed to send: ${broadcastId}`, error);
    await broadcastRepository.markFailed(env.DB, broadcastId, errorMessage);

    return { success: false, error: errorMessage };
  }
};

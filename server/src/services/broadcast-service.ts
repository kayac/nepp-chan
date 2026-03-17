import type { BroadcastMessage } from "~/db";
import { logger } from "~/lib/logger";
import { broadcastRepository } from "~/repository/broadcast-repository";
import { createLineClient } from "~/services/line-messaging";

const generateTitle = (text: string) =>
  text.slice(0, 50) + (text.length > 50 ? "…" : "");

type CreateInput = {
  body: string;
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

  await broadcastRepository.create(env.DB, {
    id,
    title: generateTitle(input.body),
    body: input.body,
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
  body?: string;
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
    scheduledAt?: string | null;
    status?: string;
  } = {};

  if (input.body !== undefined) {
    updateData.body = input.body;
    updateData.title = generateTitle(input.body);
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

    await client.broadcast(
      {
        messages: [
          {
            type: "text",
            text: broadcast.body,
          },
        ],
      },
      retryKey,
    );

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

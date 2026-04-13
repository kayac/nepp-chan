import type { D1Store } from "@mastra/cloudflare-d1";
import { logger } from "~/lib/logger";
import { broadcastRepository } from "~/repository/broadcast-repository";
import { userBroadcastStateRepository } from "~/repository/user-broadcast-state-repository";

const DEFAULT_LOOKBACK_DAYS = 7;

const buildSystemContent = (title: string, body: string, sentAt: string) => {
  const date = sentAt.slice(0, 10);
  return `【LINE配信のお知らせ（${date}）】${title}\n${body}`;
};

export const injectBroadcastsToThread = async (params: {
  d1: D1Database;
  storage: D1Store;
  threadId: string;
  resourceId: string;
  userId: string;
}) => {
  const { d1, storage, threadId, resourceId, userId } = params;

  const memoryStore = await storage.getStore("memory");
  if (!memoryStore) return;

  // スレッドが存在しない場合はスキップ（初回は agent.generate がスレッド作成する）
  const thread = await memoryStore.getThreadById({ threadId });
  if (!thread) return;

  const state = await userBroadcastStateRepository.findByUserId(d1, userId);

  let since: string;
  if (state) {
    since = state.lastInjectedAt;
  } else {
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - DEFAULT_LOOKBACK_DAYS);
    since = lookback.toISOString();
  }

  const broadcasts = await broadcastRepository.findSentSince(d1, since);

  if (broadcasts.length === 0) return;

  const messages = broadcasts.map((b) => ({
    id: `broadcast-inject:${b.id}:${threadId}`,
    role: "system" as const,
    createdAt: new Date(b.sentAt!),
    threadId,
    resourceId,
    content: {
      format: 2 as const,
      parts: [
        {
          type: "text" as const,
          text: buildSystemContent(b.title, b.body, b.sentAt!),
        },
      ],
    },
  }));

  await memoryStore.saveMessages({ messages });

  const latestSentAt = broadcasts[broadcasts.length - 1]!.sentAt!;
  await userBroadcastStateRepository.upsert(d1, userId, latestSentAt);

  logger.info(
    `[broadcast-inject] Injected ${messages.length} broadcast(s) into ${threadId}`,
  );
};

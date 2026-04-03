import { Memory } from "@mastra/memory";
import { HTTPException } from "hono/http-exception";

import { getStorage } from "~/lib/storage";
import { feedbackRepository } from "~/repository/feedback-repository";
import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";

export const verifyThreadOwnership = async (
  threadId: string,
  sessionResourceId: string | undefined,
  db: D1Database,
) => {
  if (!sessionResourceId) {
    throw new HTTPException(401, { message: "認証が必要です" });
  }

  const storage = await getStorage(db);
  const memory = new Memory({ storage });

  const thread = await memory.getThreadById({ threadId });
  if (!thread) {
    throw new HTTPException(404, { message: "スレッドが見つかりません" });
  }

  if (thread.resourceId !== sessionResourceId) {
    throw new HTTPException(403, {
      message: "このスレッドへのアクセス権がありません",
    });
  }

  return thread;
};

export const deleteThreadWithRelatedData = async (
  threadId: string,
  db: D1Database,
): Promise<void> => {
  const storage = await getStorage(db);
  const memory = new Memory({ storage });

  const thread = await memory.getThreadById({ threadId });
  if (!thread) {
    throw new HTTPException(404, { message: "スレッドが見つかりません" });
  }

  await feedbackRepository.deleteByThreadId(db, threadId);
  await threadPersonaStatusRepository.delete(db, threadId);
  await memory.deleteThread(threadId);
};

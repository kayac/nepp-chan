import { Memory } from "@mastra/memory";
import { HTTPException } from "hono/http-exception";

import { getStorage } from "~/lib/storage";
import { feedbackRepository } from "~/repository/feedback-repository";
import { mastraMessageRepository } from "~/repository/mastra-message-repository";
import { mastraThreadRepository } from "~/repository/mastra-thread-repository";
import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";

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
  await threadPersonaStatusRepository.deleteWithDelegatedByThreadId(
    db,
    threadId,
  );
  await memory.deleteThread(threadId);
  await mastraMessageRepository.deleteWithDelegatedByThreadId(db, threadId);
  await mastraThreadRepository.deleteWithDelegatedById(db, threadId);
};

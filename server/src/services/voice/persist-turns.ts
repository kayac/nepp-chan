import { logger } from "~/lib/logger";
import { getStorage } from "~/lib/storage";

export const VOICE_THREAD_TITLE = "音声通話";

export type VoiceTurn = { userText: string; assistantText: string };

const textContent = (text: string) => ({
  format: 2 as const,
  parts: [{ type: "text" as const, text }],
});

export const saveVoiceTurns = async ({
  db,
  threadId,
  resourceId,
  createdAt,
  turns,
  now = new Date(),
}: {
  db: D1Database;
  threadId: string;
  resourceId: string;
  createdAt: Date;
  turns: (VoiceTurn & { turnIndex: number })[];
  now?: Date;
}) => {
  const storage = await getStorage(db);
  const memoryStore = await storage.getStore("memory");
  if (!memoryStore) throw new Error("Memory storage is unavailable");

  const thread = {
    id: threadId,
    resourceId,
    title: VOICE_THREAD_TITLE,
    createdAt,
    updatedAt: now,
  };
  const messages = turns.flatMap(({ turnIndex, userText, assistantText }) => {
    const userAt = new Date(now.getTime() + turnIndex * 2);
    const assistantAt = new Date(userAt.getTime() + 1);
    return [
      {
        id: `${threadId}:turn:${turnIndex}:user`,
        role: "user" as const,
        createdAt: userAt,
        threadId,
        resourceId,
        content: textContent(userText),
      },
      {
        id: `${threadId}:turn:${turnIndex}:assistant`,
        role: "assistant" as const,
        createdAt: assistantAt,
        threadId,
        resourceId,
        content: textContent(assistantText),
      },
    ];
  });
  const save = async () => {
    await memoryStore.saveThread({ thread });
    await memoryStore.saveMessages({ messages });
  };

  try {
    await save();
  } catch (error) {
    logger.warn("[Voice] retrying turn persistence", {
      error: error instanceof Error ? error.message : String(error),
      threadId,
    });
    await save();
  }
};

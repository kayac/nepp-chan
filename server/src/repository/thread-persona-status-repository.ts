import { eq } from "drizzle-orm";

import { createDb, type ThreadPersonaStatus, threadPersonaStatus } from "~/db";

type UpsertInput = {
  threadId: string;
  lastExtractedAt: string;
  lastMessageCount: number;
};

export const threadPersonaStatusRepository = {
  async findByThreadId(d1: D1Database, threadId: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(threadPersonaStatus)
      .where(eq(threadPersonaStatus.threadId, threadId))
      .get();

    return result ?? null;
  },

  async findAll(d1: D1Database) {
    const db = createDb(d1);

    return db.select().from(threadPersonaStatus).all();
  },

  async upsert(d1: D1Database, input: UpsertInput) {
    const db = createDb(d1);

    await db
      .insert(threadPersonaStatus)
      .values({
        threadId: input.threadId,
        lastExtractedAt: input.lastExtractedAt,
        lastMessageCount: input.lastMessageCount,
      })
      .onConflictDoUpdate({
        target: threadPersonaStatus.threadId,
        set: {
          lastExtractedAt: input.lastExtractedAt,
          lastMessageCount: input.lastMessageCount,
        },
      });
  },

  async delete(d1: D1Database, threadId: string) {
    const db = createDb(d1);

    await db
      .delete(threadPersonaStatus)
      .where(eq(threadPersonaStatus.threadId, threadId));
  },
};

export type { ThreadPersonaStatus };

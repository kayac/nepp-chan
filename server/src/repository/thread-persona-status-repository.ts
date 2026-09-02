import { eq, sql } from "drizzle-orm";

import { createDb, type ThreadPersonaStatus, threadPersonaStatus } from "~/db";
import { deleteWithCount } from "./delete-with-count";

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

  async syncMessageCounts(d1: D1Database) {
    const db = createDb(d1);

    await db.run(sql`
      UPDATE thread_persona_status
      SET last_message_count = COALESCE((
        SELECT COUNT(*) FROM mastra_messages
        WHERE mastra_messages.thread_id = thread_persona_status.thread_id
      ), 0)
    `);
  },

  async deleteOrphaned(d1: D1Database) {
    const db = createDb(d1);

    return deleteWithCount(
      db,
      threadPersonaStatus,
      sql`${threadPersonaStatus.threadId} NOT IN (SELECT id FROM mastra_threads)`,
    );
  },

  async delete(d1: D1Database, threadId: string) {
    const db = createDb(d1);

    await db
      .delete(threadPersonaStatus)
      .where(eq(threadPersonaStatus.threadId, threadId));
  },
};

export type { ThreadPersonaStatus };

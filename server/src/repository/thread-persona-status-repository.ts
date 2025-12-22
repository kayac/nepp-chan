export type ThreadPersonaStatus = {
  threadId: string;
  lastExtractedAt: string | null;
  lastMessageCount: number;
};

type UpsertInput = {
  threadId: string;
  lastExtractedAt: string;
  lastMessageCount: number;
};

export const threadPersonaStatusRepository = {
  async findByThreadId(db: D1Database, threadId: string) {
    const result = await db
      .prepare(
        `SELECT thread_id as threadId, last_extracted_at as lastExtractedAt, last_message_count as lastMessageCount
         FROM thread_persona_status WHERE thread_id = ?`,
      )
      .bind(threadId)
      .first<ThreadPersonaStatus>();

    return result;
  },

  async findAll(db: D1Database) {
    const result = await db
      .prepare(
        `SELECT thread_id as threadId, last_extracted_at as lastExtractedAt, last_message_count as lastMessageCount
         FROM thread_persona_status`,
      )
      .all<ThreadPersonaStatus>();

    return result.results;
  },

  async upsert(db: D1Database, input: UpsertInput) {
    const result = await db
      .prepare(
        `INSERT INTO thread_persona_status (thread_id, last_extracted_at, last_message_count)
         VALUES (?, ?, ?)
         ON CONFLICT(thread_id) DO UPDATE SET
           last_extracted_at = excluded.last_extracted_at,
           last_message_count = excluded.last_message_count`,
      )
      .bind(input.threadId, input.lastExtractedAt, input.lastMessageCount)
      .run();

    return { success: result.success };
  },

  async delete(db: D1Database, threadId: string) {
    const result = await db
      .prepare("DELETE FROM thread_persona_status WHERE thread_id = ?")
      .bind(threadId)
      .run();

    return { success: result.success };
  },
};

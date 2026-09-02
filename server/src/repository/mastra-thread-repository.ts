import { desc, eq, sql } from "drizzle-orm";

import { createDb, mastraThreads } from "~/db";
import { deleteWithCount } from "./delete-with-count";

export const mastraThreadRepository = {
  async findAll(d1: D1Database) {
    const db = createDb(d1);

    return db
      .select({
        id: mastraThreads.id,
        resourceId: mastraThreads.resourceId,
      })
      .from(mastraThreads)
      .orderBy(desc(mastraThreads.id))
      .all();
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);

    const result = await db
      .select({
        id: mastraThreads.id,
        resourceId: mastraThreads.resourceId,
      })
      .from(mastraThreads)
      .where(eq(mastraThreads.id, id))
      .get();

    return result ?? null;
  },

  async deleteById(d1: D1Database, id: string) {
    const db = createDb(d1);

    return deleteWithCount(db, mastraThreads, eq(mastraThreads.id, id));
  },

  async deleteEmptyCreatedBefore(d1: D1Database, cutoff: string) {
    const db = createDb(d1);

    return deleteWithCount(
      db,
      mastraThreads,
      sql`${mastraThreads.id} NOT IN (SELECT DISTINCT thread_id FROM mastra_messages)
        AND datetime(${mastraThreads.createdAt}) < datetime(${cutoff})`,
    );
  },
};

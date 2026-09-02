import { desc, eq } from "drizzle-orm";

import { createDb, mastraThreads } from "~/db";

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
};

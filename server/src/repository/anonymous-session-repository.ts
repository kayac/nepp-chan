import { eq } from "drizzle-orm";
import { anonymousSessions, createDb } from "~/db";

export const anonymousSessionRepository = {
  async findByResourceId(d1: D1Database, resourceId: string) {
    const db = createDb(d1);
    return db
      .select()
      .from(anonymousSessions)
      .where(eq(anonymousSessions.resourceId, resourceId))
      .get();
  },

  async create(d1: D1Database, resourceId: string) {
    const db = createDb(d1);
    await db.insert(anonymousSessions).values({
      resourceId,
      createdAt: new Date().toISOString(),
    });
  },
};

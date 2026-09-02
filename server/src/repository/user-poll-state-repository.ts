import { eq } from "drizzle-orm";

import { createDb, userPollState } from "~/db";
import { deleteWithCount } from "./delete-with-count";

export const userPollStateRepository = {
  async findByUserId(d1: D1Database, userId: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(userPollState)
      .where(eq(userPollState.userId, userId))
      .get();

    return result ?? null;
  },

  async upsert(d1: D1Database, userId: string, lastInjectedAt: string) {
    const db = createDb(d1);

    await db
      .insert(userPollState)
      .values({ userId, lastInjectedAt })
      .onConflictDoUpdate({
        target: userPollState.userId,
        set: { lastInjectedAt },
      });
  },

  async deleteByUserId(d1: D1Database, userId: string) {
    const db = createDb(d1);

    return deleteWithCount(db, userPollState, eq(userPollState.userId, userId));
  },
};

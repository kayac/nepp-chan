import { eq } from "drizzle-orm";

import { createDb, userPollState } from "~/db";

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
};

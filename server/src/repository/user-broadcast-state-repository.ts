import { eq } from "drizzle-orm";

import { createDb, userBroadcastState } from "~/db";
import { deleteWithCount } from "./delete-with-count";

export const userBroadcastStateRepository = {
  async findByUserId(d1: D1Database, userId: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(userBroadcastState)
      .where(eq(userBroadcastState.userId, userId))
      .get();

    return result ?? null;
  },

  async upsert(d1: D1Database, userId: string, lastInjectedAt: string) {
    const db = createDb(d1);

    await db
      .insert(userBroadcastState)
      .values({ userId, lastInjectedAt })
      .onConflictDoUpdate({
        target: userBroadcastState.userId,
        set: { lastInjectedAt },
      });
  },

  async deleteByUserId(d1: D1Database, userId: string) {
    const db = createDb(d1);

    return deleteWithCount(
      db,
      userBroadcastState,
      eq(userBroadcastState.userId, userId),
    );
  },
};

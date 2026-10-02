import { and, type Column, desc, eq, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { createDb, mastraThreads } from "~/db";
import { deleteWithCount } from "./delete-with-count";

export const mastraThreadRepository = {
  // Mastra の委譲先スレッドは id・resourceId とも「委譲元の値-」で始まる
  async findAllRoots(d1: D1Database) {
    const db = createDb(d1);
    const parent = alias(mastraThreads, "parent");
    const startsWithParent = (child: Column, parentValue: Column) =>
      sql`substr(${child}, 1, length(${parentValue}) + 1) = ${parentValue} || '-'`;

    return db
      .select({
        id: mastraThreads.id,
        resourceId: mastraThreads.resourceId,
      })
      .from(mastraThreads)
      .where(
        notExists(
          db
            .select({ id: parent.id })
            .from(parent)
            .where(
              and(
                startsWithParent(mastraThreads.id, parent.id),
                startsWithParent(mastraThreads.resourceId, parent.resourceId),
              ),
            ),
        ),
      )
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

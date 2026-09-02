import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import type { DbClient } from "~/db";

export const deleteWithCount = async (
  db: DbClient,
  table: SQLiteTable,
  where: SQL,
) => {
  const row = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(table)
    .where(where)
    .get();

  const count = Number(row?.c ?? 0);
  if (count > 0) {
    await db.delete(table).where(where);
  }
  return count;
};

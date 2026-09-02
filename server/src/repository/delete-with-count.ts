import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import type { DbClient } from "~/db";

// DELETE の戻り値は D1 が meta.changes、libsql が rowsAffected で形が違う
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

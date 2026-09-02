import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import type { DbClient } from "~/db";

// 削除件数は D1 のドライバ差を避けて COUNT で取る。
// 0 件のときに DELETE を撃たないのは Cron の空振りで書き込みを発生させないため
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

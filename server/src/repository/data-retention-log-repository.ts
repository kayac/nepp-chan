import { sql } from "drizzle-orm";

import { createDb, dataRetentionLogs, type NewDataRetentionLog } from "~/db";
import { deleteWithCount } from "./delete-with-count";

export const dataRetentionLogRepository = {
  async create(d1: D1Database, input: NewDataRetentionLog) {
    const db = createDb(d1);

    await db.insert(dataRetentionLogs).values(input);
  },

  async deleteExecutedBefore(d1: D1Database, cutoff: string) {
    const db = createDb(d1);

    return deleteWithCount(
      db,
      dataRetentionLogs,
      sql`datetime(${dataRetentionLogs.executedAt}) < datetime(${cutoff})`,
    );
  },
};

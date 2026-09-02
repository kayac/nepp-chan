import { sql } from "drizzle-orm";

import { createDb, retrievalRuns } from "~/db";
import { deleteWithCount } from "./delete-with-count";

export const retrievalRunRepository = {
  async deleteCreatedBefore(d1: D1Database, cutoff: string) {
    const db = createDb(d1);

    return deleteWithCount(
      db,
      retrievalRuns,
      sql`datetime(${retrievalRuns.createdAt}) < datetime(${cutoff})`,
    );
  },
};

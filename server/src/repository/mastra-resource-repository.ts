import { sql } from "drizzle-orm";

import { createDb, mastraResources } from "~/db";
import { deleteWithCount } from "./delete-with-count";

export const mastraResourceRepository = {
  async deleteUpdatedBefore(d1: D1Database, cutoff: string) {
    const db = createDb(d1);

    return deleteWithCount(
      db,
      mastraResources,
      sql`datetime(${mastraResources.updatedAt}) < datetime(${cutoff})`,
    );
  },
};

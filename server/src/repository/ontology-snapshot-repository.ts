import { eq } from "drizzle-orm";
import { createDb, type NewOntologySnapshot, ontologySnapshots } from "~/db";

export const ONTOLOGY_SNAPSHOT_ID = "latest";

export const ontologySnapshotRepository = {
  async upsert(d1: D1Database, input: NewOntologySnapshot) {
    const db = createDb(d1);

    await db
      .insert(ontologySnapshots)
      .values(input)
      .onConflictDoUpdate({
        target: ontologySnapshots.id,
        set: {
          dataJson: input.dataJson,
          entityCount: input.entityCount,
          generatedAt: input.generatedAt,
          generatedBy: input.generatedBy,
        },
      });
  },

  async getLatest(d1: D1Database) {
    const db = createDb(d1);

    return db
      .select()
      .from(ontologySnapshots)
      .where(eq(ontologySnapshots.id, ONTOLOGY_SNAPSHOT_ID))
      .get();
  },
};

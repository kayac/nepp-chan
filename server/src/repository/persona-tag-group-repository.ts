import { eq, sql } from "drizzle-orm";
import { createDb, personaTagAliases, personaTagGroups } from "~/db";

type AliasInput = {
  tag: string;
  groupId: string | null;
  assignedBy: "seed" | "llm" | "human";
};

export const personaTagGroupRepository = {
  async listGroups(d1: D1Database) {
    const db = createDb(d1);
    return db
      .select()
      .from(personaTagGroups)
      .orderBy(personaTagGroups.sortOrder)
      .all();
  },

  async listAliases(d1: D1Database) {
    const db = createDb(d1);
    return db.select().from(personaTagAliases).all();
  },

  async insertAliasesIfAbsent(d1: D1Database, inputs: AliasInput[]) {
    if (inputs.length === 0) return;
    const db = createDb(d1);
    const createdAt = new Date().toISOString();
    await db
      .insert(personaTagAliases)
      .values(inputs.map((input) => ({ ...input, createdAt })))
      .onConflictDoNothing();
  },

  async setAlias(d1: D1Database, input: AliasInput) {
    const db = createDb(d1);
    const now = new Date().toISOString();
    await db
      .insert(personaTagAliases)
      .values({ ...input, createdAt: now })
      .onConflictDoUpdate({
        target: personaTagAliases.tag,
        set: {
          groupId: input.groupId,
          assignedBy: input.assignedBy,
          updatedAt: now,
        },
      });
  },

  async findGroup(d1: D1Database, id: string) {
    const db = createDb(d1);
    const row = await db
      .select()
      .from(personaTagGroups)
      .where(eq(personaTagGroups.id, id))
      .get();
    return row ?? null;
  },

  async countAliases(d1: D1Database) {
    const db = createDb(d1);
    const row = await db
      .select({ count: sql<number>`count(*)` })
      .from(personaTagAliases)
      .get();
    return Number(row?.count ?? 0);
  },
};

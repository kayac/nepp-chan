import { eq, sql } from "drizzle-orm";
import { createDb, personaTagAliases, personaTagGroups } from "~/db";

// D1 は 1 文あたりの bind 変数が 100 個まで。5 列なので 20 行が上限
const INSERT_CHUNK = 20;

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

  async listTagsByGroup(d1: D1Database, groupId: string) {
    const db = createDb(d1);
    const rows = await db
      .select({ tag: personaTagAliases.tag })
      .from(personaTagAliases)
      .where(eq(personaTagAliases.groupId, groupId))
      .all();
    return rows.map((r) => r.tag);
  },

  async listAliases(d1: D1Database) {
    const db = createDb(d1);
    return db.select().from(personaTagAliases).all();
  },

  async insertAliasesIfAbsent(d1: D1Database, inputs: AliasInput[]) {
    if (inputs.length === 0) return;
    const db = createDb(d1);
    const createdAt = new Date().toISOString();
    const chunks = Array.from(
      { length: Math.ceil(inputs.length / INSERT_CHUNK) },
      (_, i) => inputs.slice(i * INSERT_CHUNK, (i + 1) * INSERT_CHUNK),
    );
    const [first, ...rest] = chunks.map((chunk) =>
      db
        .insert(personaTagAliases)
        .values(chunk.map((input) => ({ ...input, createdAt })))
        .onConflictDoNothing(),
    );
    await db.batch([first, ...rest]);
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

  async createGroup(
    d1: D1Database,
    input: {
      id: string;
      name: string;
      kind: string;
      axis: string | null;
      sortOrder: number;
    },
  ) {
    const db = createDb(d1);
    return db
      .insert(personaTagGroups)
      .values({ ...input, createdAt: new Date().toISOString() })
      .returning()
      .get();
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

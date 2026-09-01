import { asc, eq } from "drizzle-orm";
import {
  createDb,
  type KnowledgeSource,
  knowledgeSources,
  type NewKnowledgeSource,
} from "~/db";

export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "disabled",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

type UpdateInput = Partial<Omit<KnowledgeSource, "sourcePath" | "createdAt">>;

const update = async (
  d1: D1Database,
  sourcePath: string,
  patch: UpdateInput,
) => {
  const db = createDb(d1);
  await db
    .update(knowledgeSources)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(knowledgeSources.sourcePath, sourcePath));
};

export const knowledgeSourceRepository = {
  async findByPath(d1: D1Database, sourcePath: string) {
    const db = createDb(d1);
    const result = await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.sourcePath, sourcePath))
      .get();
    return result ?? null;
  },

  async list(d1: D1Database) {
    const db = createDb(d1);
    return await db
      .select()
      .from(knowledgeSources)
      .orderBy(asc(knowledgeSources.sourcePath))
      .all();
  },

  async insert(d1: D1Database, values: NewKnowledgeSource) {
    const db = createDb(d1);
    return await db.insert(knowledgeSources).values(values).returning().get();
  },

  update,

  markIndexed(d1: D1Database, sourcePath: string, chunkCount: number) {
    return update(d1, sourcePath, {
      chunkCount,
      indexedAt: new Date().toISOString(),
    });
  },

  markRemoved(d1: D1Database, sourcePath: string) {
    return update(d1, sourcePath, { chunkCount: 0, indexedAt: null });
  },

  async markAllRemoved(d1: D1Database) {
    const db = createDb(d1);
    await db.update(knowledgeSources).set({
      chunkCount: 0,
      indexedAt: null,
      updatedAt: new Date().toISOString(),
    });
  },
};

export type { KnowledgeSource };

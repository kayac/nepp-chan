import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  createDb,
  type KnowledgeCorrection,
  knowledgeCorrections,
  type NewKnowledgeCorrection,
} from "~/db";

type UpdateInput = Partial<Omit<KnowledgeCorrection, "id" | "createdAt">>;

export const knowledgeCorrectionRepository = {
  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);
    const result = await db
      .select()
      .from(knowledgeCorrections)
      .where(eq(knowledgeCorrections.id, id))
      .get();
    return result ?? null;
  },

  async list(d1: D1Database) {
    const db = createDb(d1);
    return await db
      .select()
      .from(knowledgeCorrections)
      .orderBy(desc(knowledgeCorrections.createdAt))
      .all();
  },

  async listPublished(d1: D1Database) {
    const db = createDb(d1);
    return await db
      .select()
      .from(knowledgeCorrections)
      .where(eq(knowledgeCorrections.status, "published"))
      .all();
  },

  async listPublishedByCorrects(d1: D1Database, sourcePaths: string[]) {
    if (sourcePaths.length === 0) return [];
    const db = createDb(d1);
    return await db
      .select()
      .from(knowledgeCorrections)
      .where(
        and(
          eq(knowledgeCorrections.status, "published"),
          inArray(knowledgeCorrections.correctsSourcePath, sourcePaths),
        ),
      )
      .all();
  },

  async insert(d1: D1Database, values: NewKnowledgeCorrection) {
    const db = createDb(d1);
    return await db
      .insert(knowledgeCorrections)
      .values(values)
      .returning()
      .get();
  },

  async update(d1: D1Database, id: string, patch: UpdateInput) {
    const db = createDb(d1);
    return await db
      .update(knowledgeCorrections)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(knowledgeCorrections.id, id))
      .returning()
      .get();
  },

  async markNeedsReviewByCorrects(d1: D1Database, sourcePath: string) {
    const db = createDb(d1);
    const now = new Date().toISOString();
    await db
      .update(knowledgeCorrections)
      .set({ needsReviewAt: now, updatedAt: now })
      .where(
        and(
          eq(knowledgeCorrections.correctsSourcePath, sourcePath),
          eq(knowledgeCorrections.status, "published"),
          isNull(knowledgeCorrections.needsReviewAt),
        ),
      );
  },
};

export type { KnowledgeCorrection };

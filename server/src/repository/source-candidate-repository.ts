import { desc, eq, sql } from "drizzle-orm";
import {
  createDb,
  type NewSourceCandidate,
  type SourceCandidate,
  sourceCandidates,
} from "~/db";

export const SOURCE_CANDIDATE_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export type SourceCandidateStatus = (typeof SOURCE_CANDIDATE_STATUSES)[number];

export const sourceCandidateRepository = {
  async list(d1: D1Database) {
    const db = createDb(d1);
    return await db
      .select()
      .from(sourceCandidates)
      .orderBy(
        desc(sourceCandidates.occurrenceCount),
        desc(sourceCandidates.lastSeenAt),
      )
      .all();
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);
    const result = await db
      .select()
      .from(sourceCandidates)
      .where(eq(sourceCandidates.id, id))
      .get();
    return result ?? null;
  },

  async findByUrl(d1: D1Database, url: string) {
    const db = createDb(d1);
    const result = await db
      .select()
      .from(sourceCandidates)
      .where(eq(sourceCandidates.url, url))
      .get();
    return result ?? null;
  },

  async insert(d1: D1Database, values: NewSourceCandidate) {
    const db = createDb(d1);
    return await db.insert(sourceCandidates).values(values).returning().get();
  },

  async upsertOccurrence(
    d1: D1Database,
    input: { url: string; relatedAnswerRunId?: string },
  ) {
    const db = createDb(d1);
    const now = new Date().toISOString();
    return await db
      .insert(sourceCandidates)
      .values({
        id: crypto.randomUUID(),
        url: input.url,
        relatedAnswerRunId: input.relatedAnswerRunId,
        lastSeenAt: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: sourceCandidates.url,
        set: {
          occurrenceCount: sql`${sourceCandidates.occurrenceCount} + 1`,
          lastSeenAt: now,
          updatedAt: now,
          ...(input.relatedAnswerRunId && {
            relatedAnswerRunId: input.relatedAnswerRunId,
          }),
        },
      })
      .returning()
      .get();
  },

  async updateStatus(
    d1: D1Database,
    id: string,
    input: { status: SourceCandidateStatus; decidedBy: string },
  ) {
    const db = createDb(d1);
    const now = new Date().toISOString();
    return await db
      .update(sourceCandidates)
      .set({
        status: input.status,
        decidedBy: input.decidedBy,
        decidedAt: now,
        updatedAt: now,
      })
      .where(eq(sourceCandidates.id, id))
      .returning()
      .get();
  },
};

export type { SourceCandidate };

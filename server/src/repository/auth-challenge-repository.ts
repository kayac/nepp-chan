import { and, eq, sql } from "drizzle-orm";

import {
  type AuthChallenge,
  authChallenges,
  createDb,
  type NewAuthChallenge,
} from "~/db";

type CreateInput = Omit<NewAuthChallenge, "id"> & { id: string };

export const authChallengeRepository = {
  async create(d1: D1Database, input: CreateInput) {
    const db = createDb(d1);

    await db.insert(authChallenges).values({
      id: input.id,
      challenge: input.challenge,
      type: input.type,
      email: input.email || null,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
    });

    return { success: true, id: input.id };
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.id, id))
      .get();

    return result ?? null;
  },

  async findValidById(d1: D1Database, id: string) {
    const db = createDb(d1);
    const now = new Date().toISOString();

    const result = await db
      .select()
      .from(authChallenges)
      .where(
        and(
          eq(authChallenges.id, id),
          sql`${authChallenges.expiresAt} > ${now}`,
        ),
      )
      .get();

    return result ?? null;
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db.delete(authChallenges).where(eq(authChallenges.id, id));

    return { success: true };
  },

  async deleteExpired(d1: D1Database) {
    const db = createDb(d1);
    const now = new Date().toISOString();

    await db
      .delete(authChallenges)
      .where(sql`${authChallenges.expiresAt} < ${now}`);

    return { success: true };
  },
};

export type { AuthChallenge };

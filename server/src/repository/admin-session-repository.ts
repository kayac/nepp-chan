import { and, eq, sql } from "drizzle-orm";

import {
  type AdminSession,
  adminSessions,
  createDb,
  type NewAdminSession,
} from "~/db";

type CreateInput = Omit<NewAdminSession, "id"> & { id: string };

export const adminSessionRepository = {
  async create(d1: D1Database, input: CreateInput) {
    const db = createDb(d1);

    await db.insert(adminSessions).values({
      id: input.id,
      userId: input.userId,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
      lastAccessedAt: input.lastAccessedAt ?? null,
    });

    return input.id;
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.id, id))
      .get();

    return result ?? null;
  },

  async findValidById(d1: D1Database, id: string, maxAgeDays = 90) {
    const db = createDb(d1);
    const now = new Date();
    const nowIso = now.toISOString();
    const absoluteExpiry = new Date(
      now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const result = await db
      .select()
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.id, id),
          sql`${adminSessions.expiresAt} > ${nowIso}`,
          sql`${adminSessions.createdAt} > ${absoluteExpiry}`,
        ),
      )
      .get();

    return result ?? null;
  },

  async findByUserId(d1: D1Database, userId: string) {
    const db = createDb(d1);

    const results = await db
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.userId, userId))
      .all();

    return results;
  },

  async updateLastAccessed(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db
      .update(adminSessions)
      .set({ lastAccessedAt: new Date().toISOString() })
      .where(eq(adminSessions.id, id));
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db.delete(adminSessions).where(eq(adminSessions.id, id));
  },

  async deleteByUserId(d1: D1Database, userId: string) {
    const db = createDb(d1);

    await db.delete(adminSessions).where(eq(adminSessions.userId, userId));
  },

  async deleteExpired(d1: D1Database) {
    const db = createDb(d1);
    const now = new Date().toISOString();

    await db
      .delete(adminSessions)
      .where(sql`${adminSessions.expiresAt} < ${now}`);
  },
};

export type { AdminSession };

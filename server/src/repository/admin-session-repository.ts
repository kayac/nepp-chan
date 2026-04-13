import { and, eq, gt } from "drizzle-orm";
import { adminSessions, createDb } from "~/db";
import { generateToken } from "~/lib/crypto";

const SESSION_EXPIRY_DAYS = 7;

export const adminSessionRepository = {
  async create(d1: D1Database, userId: string) {
    const db = createDb(d1);
    const token = generateToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    await db.insert(adminSessions).values({
      token,
      userId,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    });

    return token;
  },

  async findValid(d1: D1Database, token: string) {
    const db = createDb(d1);
    return db
      .select()
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.token, token),
          gt(adminSessions.expiresAt, new Date().toISOString()),
        ),
      )
      .get();
  },

  async deleteByToken(d1: D1Database, token: string) {
    const db = createDb(d1);
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
  },

  async deleteByUserId(d1: D1Database, userId: string) {
    const db = createDb(d1);
    await db.delete(adminSessions).where(eq(adminSessions.userId, userId));
  },
};

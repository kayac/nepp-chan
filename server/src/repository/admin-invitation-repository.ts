import { and, desc, eq, isNull, sql } from "drizzle-orm";

import {
  type AdminInvitation,
  adminInvitations,
  createDb,
  type NewAdminInvitation,
} from "~/db";

type CreateInput = Omit<NewAdminInvitation, "id"> & { id: string };

export const adminInvitationRepository = {
  async create(d1: D1Database, input: CreateInput) {
    const db = createDb(d1);

    await db.insert(adminInvitations).values({
      id: input.id,
      email: input.email,
      token: input.token,
      invitedBy: input.invitedBy,
      role: input.role ?? "admin",
      expiresAt: input.expiresAt,
      usedAt: input.usedAt ?? null,
      createdAt: input.createdAt,
    });

    return input.id;
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(adminInvitations)
      .where(eq(adminInvitations.id, id))
      .get();

    return result ?? null;
  },

  async findByToken(d1: D1Database, token: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(adminInvitations)
      .where(eq(adminInvitations.token, token))
      .get();

    return result ?? null;
  },

  async findByEmail(d1: D1Database, email: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(adminInvitations)
      .where(eq(adminInvitations.email, email))
      .get();

    return result ?? null;
  },

  async findValidByToken(d1: D1Database, token: string) {
    const db = createDb(d1);
    const now = new Date().toISOString();

    const result = await db
      .select()
      .from(adminInvitations)
      .where(
        and(
          eq(adminInvitations.token, token),
          isNull(adminInvitations.usedAt),
          sql`${adminInvitations.expiresAt} > ${now}`,
        ),
      )
      .get();

    return result ?? null;
  },

  async list(d1: D1Database) {
    const db = createDb(d1);

    const invitations = await db
      .select()
      .from(adminInvitations)
      .orderBy(desc(adminInvitations.createdAt))
      .all();

    return invitations;
  },

  async listPending(d1: D1Database) {
    const db = createDb(d1);
    const now = new Date().toISOString();

    const invitations = await db
      .select()
      .from(adminInvitations)
      .where(
        and(
          isNull(adminInvitations.usedAt),
          sql`${adminInvitations.expiresAt} > ${now}`,
        ),
      )
      .orderBy(desc(adminInvitations.createdAt))
      .all();

    return invitations;
  },

  async markUsed(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db
      .update(adminInvitations)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(adminInvitations.id, id));
  },

  async delete(d1: D1Database, id: string): Promise<void> {
    const db = createDb(d1);

    await db.delete(adminInvitations).where(eq(adminInvitations.id, id));
  },

  async deleteExpired(d1: D1Database): Promise<void> {
    const db = createDb(d1);
    const now = new Date().toISOString();

    await db
      .delete(adminInvitations)
      .where(sql`${adminInvitations.expiresAt} < ${now}`);
  },
};

export type { AdminInvitation };

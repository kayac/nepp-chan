import { eq } from "drizzle-orm";

import {
  type AdminCredential,
  adminCredentials,
  createDb,
  type NewAdminCredential,
} from "~/db";

type CreateInput = Omit<NewAdminCredential, "id"> & { id: string };

export const adminCredentialRepository = {
  async create(d1: D1Database, input: CreateInput) {
    const db = createDb(d1);

    await db.insert(adminCredentials).values({
      id: input.id,
      userId: input.userId,
      publicKey: input.publicKey,
      counter: input.counter ?? 0,
      deviceType: input.deviceType,
      backedUp: input.backedUp ?? false,
      transports: input.transports ?? null,
      createdAt: input.createdAt,
      lastUsedAt: input.lastUsedAt ?? null,
    });

    return { success: true, id: input.id };
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(adminCredentials)
      .where(eq(adminCredentials.id, id))
      .get();

    return result ?? null;
  },

  async findByUserId(d1: D1Database, userId: string) {
    const db = createDb(d1);

    const results = await db
      .select()
      .from(adminCredentials)
      .where(eq(adminCredentials.userId, userId))
      .all();

    return results;
  },

  async updateCounter(d1: D1Database, id: string, counter: number) {
    const db = createDb(d1);

    await db
      .update(adminCredentials)
      .set({
        counter,
        lastUsedAt: new Date().toISOString(),
      })
      .where(eq(adminCredentials.id, id));

    return { success: true };
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db.delete(adminCredentials).where(eq(adminCredentials.id, id));

    return { success: true };
  },

  async deleteByUserId(d1: D1Database, userId: string) {
    const db = createDb(d1);

    await db
      .delete(adminCredentials)
      .where(eq(adminCredentials.userId, userId));

    return { success: true };
  },
};

export type { AdminCredential };

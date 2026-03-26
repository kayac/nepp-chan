import { eq } from "drizzle-orm";

import { type AdminUser, adminUsers, createDb, type NewAdminUser } from "~/db";

type CreateInput = Omit<NewAdminUser, "id" | "updatedAt"> & { id: string };

export const adminUserRepository = {
  async create(d1: D1Database, input: CreateInput) {
    const db = createDb(d1);

    await db.insert(adminUsers).values({
      id: input.id,
      username: input.username,
      name: input.name ?? null,
      role: input.role ?? "admin",
      passwordHash: input.passwordHash,
      createdAt: input.createdAt,
    });

    return input.id;
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .get();

    return result ?? null;
  },

  async findByUsername(d1: D1Database, username: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username.toLowerCase().trim()))
      .get();

    return result ?? null;
  },

  async list(d1: D1Database) {
    const db = createDb(d1);

    const users = await db.select().from(adminUsers).all();

    return users;
  },

  async update(
    d1: D1Database,
    id: string,
    input: Partial<Pick<AdminUser, "name" | "role" | "passwordHash">>,
  ) {
    const db = createDb(d1);

    await db
      .update(adminUsers)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(adminUsers.id, id));
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db.delete(adminUsers).where(eq(adminUsers.id, id));
  },
};

export type { AdminUser };

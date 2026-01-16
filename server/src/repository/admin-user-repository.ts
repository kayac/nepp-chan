import { eq } from "drizzle-orm";

import { type AdminUser, adminUsers, createDb, type NewAdminUser } from "~/db";

type CreateInput = Omit<NewAdminUser, "id"> & { id: string };

export const adminUserRepository = {
  async create(d1: D1Database, input: CreateInput) {
    const db = createDb(d1);

    await db.insert(adminUsers).values({
      id: input.id,
      email: input.email,
      name: input.name ?? null,
      role: input.role ?? "admin",
      createdAt: input.createdAt,
      updatedAt: input.updatedAt ?? null,
    });

    return { success: true, id: input.id };
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

  async findByEmail(d1: D1Database, email: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
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
    input: Partial<Pick<AdminUser, "name" | "role">>,
  ) {
    const db = createDb(d1);

    await db
      .update(adminUsers)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(adminUsers.id, id));

    return { success: true };
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db.delete(adminUsers).where(eq(adminUsers.id, id));

    return { success: true };
  },
};

export type { AdminUser };

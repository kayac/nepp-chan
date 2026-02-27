import { desc, eq, gte } from "drizzle-orm";

import {
  createDb,
  type EmergencyReport,
  emergencyReports,
  type NewEmergencyReport,
} from "~/db";

type CreateInput = Omit<NewEmergencyReport, "id" | "updatedAt"> & {
  id: string;
};

type UpdateInput = {
  description?: string;
  location?: string;
};

export const emergencyRepository = {
  async create(d1: D1Database, input: CreateInput) {
    const db = createDb(d1);

    await db.insert(emergencyReports).values({
      id: input.id,
      type: input.type,
      description: input.description ?? null,
      location: input.location ?? null,
      reportedAt: input.reportedAt,
    });

    return input.id;
  },

  async update(d1: D1Database, id: string, input: UpdateInput) {
    const db = createDb(d1);

    const updates: Partial<typeof emergencyReports.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.description !== undefined)
      updates.description = input.description;
    if (input.location !== undefined) updates.location = input.location;

    await db
      .update(emergencyReports)
      .set(updates)
      .where(eq(emergencyReports.id, id));
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(emergencyReports)
      .where(eq(emergencyReports.id, id))
      .get();

    return result ?? null;
  },

  async findAll(d1: D1Database, limit = 100) {
    const db = createDb(d1);

    return db
      .select()
      .from(emergencyReports)
      .orderBy(desc(emergencyReports.reportedAt))
      .limit(limit)
      .all();
  },

  async findRecent(d1: D1Database, days: number, limit = 100) {
    const db = createDb(d1);

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    return db
      .select()
      .from(emergencyReports)
      .where(gte(emergencyReports.reportedAt, sinceIso))
      .orderBy(desc(emergencyReports.reportedAt))
      .limit(limit)
      .all();
  },
};

export type { EmergencyReport };

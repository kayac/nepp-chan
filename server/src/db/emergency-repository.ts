export type EmergencyReport = {
  id: string;
  type: string;
  description: string | null;
  location: string | null;
  reportedAt: string;
  updatedAt: string | null;
};

type CreateInput = {
  id: string;
  type: string;
  description?: string;
  location?: string;
  reportedAt: string;
};

type UpdateInput = {
  description?: string;
  location?: string;
};

export const emergencyRepository = {
  async create(db: D1Database, input: CreateInput) {
    const result = await db
      .prepare(
        `INSERT INTO emergency_reports (id, type, description, location, reported_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        input.id,
        input.type,
        input.description ?? null,
        input.location ?? null,
        input.reportedAt,
      )
      .run();

    return { success: result.success, id: input.id };
  },

  async update(db: D1Database, id: string, input: UpdateInput) {
    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (input.description !== undefined) {
      updates.push("description = ?");
      values.push(input.description);
    }

    if (input.location !== undefined) {
      updates.push("location = ?");
      values.push(input.location);
    }

    if (updates.length === 0) {
      return { success: false, error: "更新する項目がありません" };
    }

    updates.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    const result = await db
      .prepare(
        `UPDATE emergency_reports SET ${updates.join(", ")} WHERE id = ?`,
      )
      .bind(...values)
      .run();

    return { success: result.success };
  },

  async findById(db: D1Database, id: string) {
    const result = await db
      .prepare(
        `SELECT id, type, description, location, reported_at as reportedAt, updated_at as updatedAt
         FROM emergency_reports WHERE id = ?`,
      )
      .bind(id)
      .first<EmergencyReport>();

    return result;
  },

  async findAll(db: D1Database, limit = 100) {
    const result = await db
      .prepare(
        `SELECT id, type, description, location, reported_at as reportedAt, updated_at as updatedAt
         FROM emergency_reports ORDER BY reported_at DESC LIMIT ?`,
      )
      .bind(limit)
      .all<EmergencyReport>();

    return result.results;
  },
};

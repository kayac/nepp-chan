export type Persona = {
  id: string;
  resourceId: string;
  category: string;
  tags: string | null;
  content: string;
  source: string | null;
  topic: string | null;
  sentiment: string | null;
  demographicSummary: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type CreateInput = {
  id: string;
  resourceId: string;
  category: string;
  tags?: string;
  content: string;
  source?: string;
  topic?: string;
  sentiment?: string;
  demographicSummary?: string;
  createdAt: string;
};

type UpdateInput = {
  category?: string;
  tags?: string;
  content?: string;
  source?: string;
  topic?: string;
  sentiment?: string;
  demographicSummary?: string;
};

export type TopicAggregation = {
  topic: string;
  category: string;
  count: number;
  demographics: string;
  samples: string;
};

export const personaRepository = {
  async create(db: D1Database, input: CreateInput) {
    const result = await db
      .prepare(
        `INSERT INTO persona (id, resource_id, category, tags, content, source, topic, sentiment, demographic_summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.id,
        input.resourceId,
        input.category,
        input.tags ?? null,
        input.content,
        input.source ?? null,
        input.topic ?? null,
        input.sentiment ?? "neutral",
        input.demographicSummary ?? null,
        input.createdAt,
      )
      .run();

    return { success: result.success, id: input.id };
  },

  async update(db: D1Database, id: string, input: UpdateInput) {
    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (input.category !== undefined) {
      updates.push("category = ?");
      values.push(input.category);
    }

    if (input.tags !== undefined) {
      updates.push("tags = ?");
      values.push(input.tags);
    }

    if (input.content !== undefined) {
      updates.push("content = ?");
      values.push(input.content);
    }

    if (input.source !== undefined) {
      updates.push("source = ?");
      values.push(input.source);
    }

    if (input.topic !== undefined) {
      updates.push("topic = ?");
      values.push(input.topic);
    }

    if (input.sentiment !== undefined) {
      updates.push("sentiment = ?");
      values.push(input.sentiment);
    }

    if (input.demographicSummary !== undefined) {
      updates.push("demographic_summary = ?");
      values.push(input.demographicSummary);
    }

    if (updates.length === 0) {
      return { success: false, error: "更新する項目がありません" };
    }

    updates.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    const result = await db
      .prepare(`UPDATE persona SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    return { success: result.success };
  },

  async findById(db: D1Database, id: string) {
    const result = await db
      .prepare(
        `SELECT id, resource_id as resourceId, category, tags, content, source,
                topic, sentiment, demographic_summary as demographicSummary,
                created_at as createdAt, updated_at as updatedAt
         FROM persona WHERE id = ?`,
      )
      .bind(id)
      .first<Persona>();

    return result;
  },

  async findByResourceId(db: D1Database, resourceId: string, limit = 100) {
    const result = await db
      .prepare(
        `SELECT id, resource_id as resourceId, category, tags, content, source,
                topic, sentiment, demographic_summary as demographicSummary,
                created_at as createdAt, updated_at as updatedAt
         FROM persona WHERE resource_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .bind(resourceId, limit)
      .all<Persona>();

    return result.results;
  },

  async search(
    db: D1Database,
    resourceId: string,
    options: {
      category?: string;
      tags?: string[];
      keyword?: string;
      limit?: number;
    } = {},
  ) {
    const conditions: string[] = ["resource_id = ?"];
    const values: (string | number)[] = [resourceId];

    if (options.category) {
      conditions.push("category = ?");
      values.push(options.category);
    }

    if (options.tags && options.tags.length > 0) {
      const tagConditions = options.tags.map(() => "tags LIKE ?");
      conditions.push(`(${tagConditions.join(" OR ")})`);
      for (const tag of options.tags) {
        values.push(`%${tag}%`);
      }
    }

    if (options.keyword) {
      conditions.push("content LIKE ?");
      values.push(`%${options.keyword}%`);
    }

    const limit = options.limit ?? 50;
    values.push(limit);

    const result = await db
      .prepare(
        `SELECT id, resource_id as resourceId, category, tags, content, source,
                topic, sentiment, demographic_summary as demographicSummary,
                created_at as createdAt, updated_at as updatedAt
         FROM persona WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
      )
      .bind(...values)
      .all<Persona>();

    return result.results;
  },

  async aggregateByTopic(
    db: D1Database,
    resourceId: string,
    options: { category?: string; limit?: number } = {},
  ) {
    const conditions: string[] = ["resource_id = ?", "topic IS NOT NULL"];
    const values: (string | number)[] = [resourceId];

    if (options.category) {
      conditions.push("category = ?");
      values.push(options.category);
    }

    const limit = options.limit ?? 20;
    values.push(limit);

    const result = await db
      .prepare(
        `SELECT
           topic,
           category,
           COUNT(*) as count,
           GROUP_CONCAT(DISTINCT demographic_summary) as demographics,
           GROUP_CONCAT(content, ' | ') as samples
         FROM persona
         WHERE ${conditions.join(" AND ")}
         GROUP BY topic, category
         ORDER BY count DESC
         LIMIT ?`,
      )
      .bind(...values)
      .all<TopicAggregation>();

    return result.results;
  },

  async delete(db: D1Database, id: string) {
    const result = await db
      .prepare("DELETE FROM persona WHERE id = ?")
      .bind(id)
      .run();

    return { success: result.success };
  },
};

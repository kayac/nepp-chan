import { and, desc, eq, like, or, sql } from "drizzle-orm";

import { createDb, type Persona, persona } from "~/db";

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
  conversationEndedAt?: string;
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
  async create(d1: D1Database, input: CreateInput) {
    const db = createDb(d1);

    await db.insert(persona).values({
      id: input.id,
      resourceId: input.resourceId,
      category: input.category,
      tags: input.tags ?? null,
      content: input.content,
      source: input.source ?? null,
      topic: input.topic ?? null,
      sentiment: input.sentiment ?? "neutral",
      demographicSummary: input.demographicSummary ?? null,
      createdAt: input.createdAt,
      conversationEndedAt: input.conversationEndedAt ?? null,
    });

    return { success: true, id: input.id };
  },

  async update(d1: D1Database, id: string, input: UpdateInput) {
    const db = createDb(d1);

    const updates: Partial<typeof persona.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.category !== undefined) updates.category = input.category;
    if (input.tags !== undefined) updates.tags = input.tags;
    if (input.content !== undefined) updates.content = input.content;
    if (input.source !== undefined) updates.source = input.source;
    if (input.topic !== undefined) updates.topic = input.topic;
    if (input.sentiment !== undefined) updates.sentiment = input.sentiment;
    if (input.demographicSummary !== undefined)
      updates.demographicSummary = input.demographicSummary;

    const hasUpdates = Object.keys(updates).length > 1; // updatedAt 以外があるか
    if (!hasUpdates) {
      return { success: false, error: "更新する項目がありません" };
    }

    await db.update(persona).set(updates).where(eq(persona.id, id));

    return { success: true };
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(persona)
      .where(eq(persona.id, id))
      .get();

    return result ?? null;
  },

  async findByResourceId(
    d1: D1Database,
    resourceId: string,
    limit = 100,
  ): Promise<Persona[]> {
    const db = createDb(d1);

    return db
      .select()
      .from(persona)
      .where(eq(persona.resourceId, resourceId))
      .orderBy(desc(persona.createdAt))
      .limit(limit)
      .all();
  },

  async search(
    d1: D1Database,
    resourceId: string,
    options: {
      category?: string;
      tags?: string[];
      keyword?: string;
      limit?: number;
    } = {},
  ): Promise<Persona[]> {
    const db = createDb(d1);

    const conditions = [eq(persona.resourceId, resourceId)];

    if (options.category) {
      conditions.push(eq(persona.category, options.category));
    }

    if (options.tags && options.tags.length > 0) {
      const tagConditions = options.tags.map((tag) =>
        like(persona.tags, `%${tag}%`),
      );
      const tagCondition = or(...tagConditions);
      if (tagCondition) conditions.push(tagCondition);
    }

    if (options.keyword) {
      conditions.push(like(persona.content, `%${options.keyword}%`));
    }

    return db
      .select()
      .from(persona)
      .where(and(...conditions))
      .orderBy(desc(persona.createdAt))
      .limit(options.limit ?? 50)
      .all();
  },

  async aggregateByTopic(
    d1: D1Database,
    resourceId: string,
    options: { category?: string; limit?: number } = {},
  ): Promise<TopicAggregation[]> {
    const db = createDb(d1);

    const conditions = [
      eq(persona.resourceId, resourceId),
      sql`${persona.topic} IS NOT NULL`,
    ];

    if (options.category) {
      conditions.push(eq(persona.category, options.category));
    }

    const result = await db
      .select({
        topic: persona.topic,
        category: persona.category,
        count: sql<number>`COUNT(*)`,
        demographics: sql<string>`GROUP_CONCAT(DISTINCT ${persona.demographicSummary})`,
        samples: sql<string>`GROUP_CONCAT(${persona.content}, ' | ')`,
      })
      .from(persona)
      .where(and(...conditions))
      .groupBy(persona.topic, persona.category)
      .orderBy(sql`count DESC`)
      .limit(options.limit ?? 20)
      .all();

    return result as TopicAggregation[];
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db.delete(persona).where(eq(persona.id, id));

    return { success: true };
  },
};

export type { Persona };

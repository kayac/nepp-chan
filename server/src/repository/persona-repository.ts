import { and, count, desc, eq, like, or, type SQL, sql } from "drizzle-orm";

import { createDb, type NewPersona, type Persona, persona } from "~/db";

type CreateInput = Omit<NewPersona, "id" | "updatedAt"> & { id: string };

type UpdateInput = {
  category?: string;
  tags?: string;
  content?: string;
  source?: string;
  topic?: string;
  sentiment?: string;
  demographicSummary?: string;
  entities?: string;
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
      category: input.category,
      tags: input.tags ?? null,
      content: input.content,
      source: input.source ?? null,
      topic: input.topic ?? null,
      sentiment: input.sentiment ?? "neutral",
      demographicSummary: input.demographicSummary ?? null,
      entities: input.entities ?? null,
      createdAt: input.createdAt,
      conversationEndedAt: input.conversationEndedAt ?? null,
    });

    return input.id;
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
    if (input.entities !== undefined) updates.entities = input.entities;

    await db.update(persona).set(updates).where(eq(persona.id, id));
  },

  // entities 未処理（NULL）の persona を content つきで取得する（バックフィル用）
  async listMissingEntities(d1: D1Database, limit: number) {
    const db = createDb(d1);

    return db
      .select({ id: persona.id, content: persona.content })
      .from(persona)
      .where(sql`${persona.entities} IS NULL`)
      .limit(limit)
      .all();
  },

  async countMissingEntities(d1: D1Database) {
    const db = createDb(d1);

    const row = await db
      .select({ value: count() })
      .from(persona)
      .where(sql`${persona.entities} IS NULL`)
      .get();

    return row?.value ?? 0;
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

  async search(
    d1: D1Database,
    options: {
      category?: string;
      tags?: string[];
      keyword?: string;
      limit?: number;
    } = {},
  ) {
    const db = createDb(d1);

    const conditions: SQL[] = [];

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
      const words = options.keyword
        .split(/\s+/)
        .filter((w) => w.length > 0)
        .slice(0, 5);
      if (words.length === 1) {
        conditions.push(like(persona.content, `%${words[0]}%`));
      } else if (words.length > 1) {
        const wordConditions = words.map((w) =>
          like(persona.content, `%${w}%`),
        );
        const wordCondition = or(...wordConditions);
        if (wordCondition) conditions.push(wordCondition);
      }
    }

    return db
      .select()
      .from(persona)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(persona.createdAt))
      .limit(options.limit ?? 50)
      .all();
  },

  async aggregateByTopic(
    d1: D1Database,
    options: { category?: string; limit?: number } = {},
  ): Promise<TopicAggregation[]> {
    const db = createDb(d1);

    const conditions: SQL[] = [sql`${persona.topic} IS NOT NULL`];

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
      .orderBy(sql`COUNT(*) DESC`)
      .limit(options.limit ?? 20)
      .all();

    return result as TopicAggregation[];
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db.delete(persona).where(eq(persona.id, id));
  },

  async list(
    d1: D1Database,
    options: {
      category?: string;
      sentiment?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const db = createDb(d1);
    const limit = options.limit ?? 30;

    const conditions = [];

    if (options.category) {
      conditions.push(eq(persona.category, options.category));
    }

    if (options.sentiment) {
      conditions.push(eq(persona.sentiment, options.sentiment));
    }

    if (options.cursor) {
      conditions.push(sql`${persona.createdAt} < ${options.cursor}`);
    }

    const personas = await db
      .select()
      .from(persona)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(persona.createdAt))
      .limit(limit + 1)
      .all();

    const hasMore = personas.length > limit;
    const items = hasMore ? personas.slice(0, limit) : personas;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt : null;

    return {
      personas: items,
      nextCursor,
      hasMore,
    };
  },

  async listForAdmin(
    d1: D1Database,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{
    personas: Persona[];
    total: number;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const db = createDb(d1);
    const limit = options.limit ?? 30;

    const sortDate = sql`COALESCE(${persona.conversationEndedAt}, ${persona.createdAt})`;

    let cursorCondition: SQL | undefined;
    if (options.cursor) {
      const [cursorDate, cursorId] = options.cursor.split("_");
      cursorCondition = sql`(${sortDate} < ${cursorDate} OR (${sortDate} = ${cursorDate} AND ${persona.id} < ${cursorId}))`;
    }

    const results = await db
      .select()
      .from(persona)
      .where(cursorCondition)
      .orderBy(sql`${sortDate} DESC`, desc(persona.id))
      .limit(limit + 1)
      .all();

    const hasMore = results.length > limit;
    const personas = hasMore ? results.slice(0, limit) : results;

    const lastPersona = personas[personas.length - 1];
    const nextCursor =
      hasMore && lastPersona
        ? `${lastPersona.conversationEndedAt ?? lastPersona.createdAt}_${lastPersona.id}`
        : null;

    const countResult = await db.select({ count: count() }).from(persona).get();

    return {
      personas,
      total: countResult?.count ?? 0,
      nextCursor,
      hasMore,
    };
  },

  async getStats(d1: D1Database) {
    const db = createDb(d1);

    const totalResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(persona)
      .get();

    const categoryResults = await db
      .select({
        category: persona.category,
        count: sql<number>`COUNT(*)`,
      })
      .from(persona)
      .groupBy(persona.category)
      .all();

    const sentimentResults = await db
      .select({
        sentiment: persona.sentiment,
        count: sql<number>`COUNT(*)`,
      })
      .from(persona)
      .where(sql`${persona.sentiment} IS NOT NULL`)
      .groupBy(persona.sentiment)
      .all();

    const byCategory: Record<string, number> = {};
    for (const row of categoryResults) {
      if (row.category) {
        byCategory[row.category] = row.count;
      }
    }

    const bySentiment: Record<string, number> = {};
    for (const row of sentimentResults) {
      if (row.sentiment) {
        bySentiment[row.sentiment] = row.count;
      }
    }

    return {
      total: totalResult?.count ?? 0,
      byCategory,
      bySentiment,
    };
  },

  async deleteAll(d1: D1Database) {
    const db = createDb(d1);

    await db.delete(persona);
  },
};

export type { Persona };

import { and, desc, eq, like, lte, sql } from "drizzle-orm";

import { type BroadcastMessage, broadcastMessages, createDb } from "~/db";

type CreateInput = {
  id: string;
  title: string;
  body: string;
  parts: string;
  status: string;
  scheduledAt?: string | null;
  createdBy: string;
  createdAt: string;
};

type UpdateInput = {
  title?: string;
  body?: string;
  parts?: string;
  scheduledAt?: string | null;
  status?: string;
};

type ListOptions = {
  limit?: number;
  cursor?: string;
  status?: string;
};

type ListResult = {
  broadcasts: BroadcastMessage[];
  nextCursor: string | null;
  hasMore: boolean;
};

type RecentSentOptions = {
  detailLimit?: number;
  summaryDays?: number;
};

type RecentSentResult = {
  details: BroadcastMessage[];
  summaries: { id: string; title: string; sentAt: string }[];
};

export const broadcastRepository = {
  async create(d1: D1Database, input: CreateInput) {
    const db = createDb(d1);

    await db.insert(broadcastMessages).values({
      id: input.id,
      title: input.title,
      body: input.body,
      parts: input.parts,
      status: input.status,
      scheduledAt: input.scheduledAt ?? null,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
    });

    return input.id;
  },

  async update(d1: D1Database, id: string, input: UpdateInput) {
    const db = createDb(d1);

    const updates: Partial<typeof broadcastMessages.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.title !== undefined) updates.title = input.title;
    if (input.body !== undefined) updates.body = input.body;
    if (input.parts !== undefined) updates.parts = input.parts;
    if (input.scheduledAt !== undefined)
      updates.scheduledAt = input.scheduledAt;
    if (input.status !== undefined) updates.status = input.status;

    await db
      .update(broadcastMessages)
      .set(updates)
      .where(eq(broadcastMessages.id, id));
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(broadcastMessages)
      .where(eq(broadcastMessages.id, id))
      .get();

    return result ?? null;
  },

  async findAll(
    d1: D1Database,
    options: ListOptions = {},
  ): Promise<ListResult> {
    const db = createDb(d1);
    const limit = options.limit ?? 30;

    const conditions = [];

    if (options.status) {
      conditions.push(eq(broadcastMessages.status, options.status));
    }

    if (options.cursor) {
      conditions.push(sql`${broadcastMessages.createdAt} < ${options.cursor}`);
    }

    const broadcasts = await db
      .select()
      .from(broadcastMessages)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(broadcastMessages.createdAt))
      .limit(limit + 1)
      .all();

    const hasMore = broadcasts.length > limit;
    const items = hasMore ? broadcasts.slice(0, limit) : broadcasts;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt : null;

    return {
      broadcasts: items,
      nextCursor,
      hasMore,
    };
  },

  async findScheduledReady(d1: D1Database) {
    const db = createDb(d1);
    const now = new Date().toISOString();

    return db
      .select()
      .from(broadcastMessages)
      .where(
        and(
          eq(broadcastMessages.status, "scheduled"),
          lte(broadcastMessages.scheduledAt, now),
        ),
      )
      .all();
  },

  async markSent(d1: D1Database, id: string) {
    const db = createDb(d1);
    const now = new Date().toISOString();

    await db
      .update(broadcastMessages)
      .set({ status: "sent", sentAt: now, updatedAt: now })
      .where(eq(broadcastMessages.id, id));
  },

  async markFailed(d1: D1Database, id: string, errorMessage: string) {
    const db = createDb(d1);
    const now = new Date().toISOString();

    await db
      .update(broadcastMessages)
      .set({ status: "failed", errorMessage, updatedAt: now })
      .where(eq(broadcastMessages.id, id));
  },

  async findRecentSent(
    d1: D1Database,
    options: RecentSentOptions = {},
  ): Promise<RecentSentResult> {
    const db = createDb(d1);
    const detailLimit = options.detailLimit ?? 3;
    const summaryDays = options.summaryDays ?? 30;

    // 直近N件（全文）
    const details = await db
      .select()
      .from(broadcastMessages)
      .where(eq(broadcastMessages.status, "sent"))
      .orderBy(desc(broadcastMessages.sentAt))
      .limit(detailLimit)
      .all();

    // それ以外の30日分（タイトル+日付のみ）
    const since = new Date();
    since.setDate(since.getDate() - summaryDays);
    const sinceIso = since.toISOString();

    const detailIds = details.map((d) => d.id);

    const allRecent = await db
      .select({
        id: broadcastMessages.id,
        title: broadcastMessages.title,
        sentAt: broadcastMessages.sentAt,
      })
      .from(broadcastMessages)
      .where(
        and(
          eq(broadcastMessages.status, "sent"),
          sql`${broadcastMessages.sentAt} >= ${sinceIso}`,
        ),
      )
      .orderBy(desc(broadcastMessages.sentAt))
      .all();

    const summaries = allRecent
      .filter((r) => !detailIds.includes(r.id))
      .map((r) => ({
        id: r.id,
        title: r.title,
        sentAt: r.sentAt ?? "",
      }));

    return { details, summaries };
  },

  async findByKeyword(d1: D1Database, keyword: string, limit = 10) {
    const db = createDb(d1);
    const escaped = keyword.replace(/[%_]/g, (c) => `\\${c}`);

    return db
      .select()
      .from(broadcastMessages)
      .where(
        and(
          eq(broadcastMessages.status, "sent"),
          sql`(${like(broadcastMessages.title, `%${escaped}%`)} OR ${like(broadcastMessages.body, `%${escaped}%`)})`,
        ),
      )
      .orderBy(desc(broadcastMessages.sentAt))
      .limit(limit)
      .all();
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db.delete(broadcastMessages).where(eq(broadcastMessages.id, id));
  },

  async count(d1: D1Database, status?: string) {
    const db = createDb(d1);

    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(broadcastMessages)
      .where(status ? eq(broadcastMessages.status, status) : undefined)
      .get();

    return result?.count ?? 0;
  },
};

export type { BroadcastMessage };

import { and, desc, count as drizzleCount, eq, sql } from "drizzle-orm";

import {
  createDb,
  type MessageFeedback,
  messageFeedback,
  type NewMessageFeedback,
} from "~/db";

type CreateInput = Omit<NewMessageFeedback, "id"> & { id: string };

type FeedbackStats = {
  total: number;
  good: number;
  bad: number;
  idea: number;
  byCategory: Record<string, number>;
};

type ListOptions = {
  limit?: number;
  cursor?: string;
  rating?: "good" | "bad" | "idea";
};

type ListResult = {
  feedbacks: MessageFeedback[];
  nextCursor: string | null;
  hasMore: boolean;
};

export const feedbackRepository = {
  async create(d1: D1Database, input: CreateInput) {
    const db = createDb(d1);

    await db.insert(messageFeedback).values({
      id: input.id,
      threadId: input.threadId,
      messageId: input.messageId,
      rating: input.rating,
      category: input.category ?? null,
      comment: input.comment ?? null,
      conversationContext: input.conversationContext,
      toolExecutions: input.toolExecutions ?? null,
      createdAt: input.createdAt,
    });

    return { success: true, id: input.id };
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);

    const result = await db
      .select()
      .from(messageFeedback)
      .where(eq(messageFeedback.id, id))
      .get();

    return result ?? null;
  },

  async list(d1: D1Database, options: ListOptions = {}): Promise<ListResult> {
    const db = createDb(d1);
    const limit = options.limit ?? 30;

    const conditions = [];

    if (options.rating) {
      conditions.push(eq(messageFeedback.rating, options.rating));
    }

    if (options.cursor) {
      conditions.push(sql`${messageFeedback.createdAt} < ${options.cursor}`);
    }

    const feedbacks = await db
      .select()
      .from(messageFeedback)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(messageFeedback.createdAt))
      .limit(limit + 1)
      .all();

    const hasMore = feedbacks.length > limit;
    const items = hasMore ? feedbacks.slice(0, limit) : feedbacks;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt : null;

    return {
      feedbacks: items,
      nextCursor,
      hasMore,
    };
  },

  async getStats(d1: D1Database): Promise<FeedbackStats> {
    const db = createDb(d1);

    const totalResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(messageFeedback)
      .get();

    const goodResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(messageFeedback)
      .where(eq(messageFeedback.rating, "good"))
      .get();

    const badResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(messageFeedback)
      .where(eq(messageFeedback.rating, "bad"))
      .get();

    const ideaResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(messageFeedback)
      .where(eq(messageFeedback.rating, "idea"))
      .get();

    const categoryResults = await db
      .select({
        category: messageFeedback.category,
        count: sql<number>`COUNT(*)`,
      })
      .from(messageFeedback)
      .where(sql`${messageFeedback.category} IS NOT NULL`)
      .groupBy(messageFeedback.category)
      .all();

    const byCategory: Record<string, number> = {};
    for (const row of categoryResults) {
      if (row.category) {
        byCategory[row.category] = row.count;
      }
    }

    return {
      total: totalResult?.count ?? 0,
      good: goodResult?.count ?? 0,
      bad: badResult?.count ?? 0,
      idea: ideaResult?.count ?? 0,
      byCategory,
    };
  },

  async count(d1: D1Database): Promise<number> {
    const db = createDb(d1);

    const result = await db
      .select({ count: drizzleCount() })
      .from(messageFeedback)
      .get();

    return result?.count ?? 0;
  },

  async deleteByThreadId(d1: D1Database, threadId: string) {
    const db = createDb(d1);

    await db
      .delete(messageFeedback)
      .where(eq(messageFeedback.threadId, threadId));

    return { success: true };
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db.delete(messageFeedback).where(eq(messageFeedback.id, id));

    return { success: true };
  },

  async deleteAll(d1: D1Database) {
    const db = createDb(d1);

    await db.delete(messageFeedback);

    return { success: true };
  },

  async resolve(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db
      .update(messageFeedback)
      .set({ resolvedAt: new Date().toISOString() })
      .where(eq(messageFeedback.id, id));

    return { success: true };
  },

  async unresolve(d1: D1Database, id: string) {
    const db = createDb(d1);

    await db
      .update(messageFeedback)
      .set({ resolvedAt: null })
      .where(eq(messageFeedback.id, id));

    return { success: true };
  },
};

export type { MessageFeedback, FeedbackStats };

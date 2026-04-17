import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";

import {
  createDb,
  type Poll,
  type PollSubmission,
  pollSubmissions,
  polls,
} from "~/db";

type PollStatus = Poll["status"];

type CreatePollInput = {
  id: string;
  title: string;
  choices: string; // JSON
  followUpPrompt?: string | null;
  status: PollStatus;
  scheduledAt?: string | null;
  createdBy: string;
  createdAt: string;
};

type ListOptions = {
  limit?: number;
  cursor?: string;
  status?: PollStatus;
};

export const pollRepository = {
  // --- Poll CRUD ---

  async create(d1: D1Database, input: CreatePollInput) {
    const db = createDb(d1);
    await db.insert(polls).values({
      id: input.id,
      title: input.title,
      choices: input.choices,
      followUpPrompt: input.followUpPrompt ?? null,
      status: input.status,
      scheduledAt: input.scheduledAt ?? null,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
    });
    return input.id;
  },

  async update(
    d1: D1Database,
    id: string,
    input: Partial<{
      title: string;
      choices: string;
      followUpPrompt: string | null;
      status: PollStatus;
      scheduledAt: string | null;
      sentAt: string | null;
      closedAt: string | null;
    }>,
  ) {
    const db = createDb(d1);
    await db
      .update(polls)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(polls.id, id));
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);
    return (
      (await db.select().from(polls).where(eq(polls.id, id)).get()) ?? null
    );
  },

  async findAll(d1: D1Database, options: ListOptions = {}) {
    const db = createDb(d1);
    const limit = options.limit ?? 30;

    const conditions = [];
    if (options.status) {
      conditions.push(eq(polls.status, options.status));
    }
    if (options.cursor) {
      conditions.push(sql`${polls.createdAt} < ${options.cursor}`);
    }

    const items = await db
      .select()
      .from(polls)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(polls.createdAt))
      .limit(limit + 1)
      .all();

    const hasMore = items.length > limit;
    const result = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? result[result.length - 1]?.createdAt : null;

    return { polls: result, nextCursor, hasMore };
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);
    await db.delete(pollSubmissions).where(eq(pollSubmissions.pollId, id));
    await db.delete(polls).where(eq(polls.id, id));
  },

  async findScheduledReady(d1: D1Database) {
    const db = createDb(d1);
    const now = new Date().toISOString();
    return db
      .select()
      .from(polls)
      .where(
        and(eq(polls.status, "scheduled"), sql`${polls.scheduledAt} <= ${now}`),
      )
      .all();
  },

  async findSentSince(d1: D1Database, since: string) {
    const db = createDb(d1);
    return db
      .select()
      .from(polls)
      .where(
        and(
          inArray(polls.status, ["sent", "closed"]),
          sql`${polls.sentAt} IS NOT NULL`,
          gt(polls.sentAt, since),
        ),
      )
      .orderBy(polls.sentAt)
      .all();
  },

  // --- Submissions ---

  async findSubmission(d1: D1Database, pollId: string, userId: string) {
    const db = createDb(d1);
    return (
      (await db
        .select()
        .from(pollSubmissions)
        .where(
          and(
            eq(pollSubmissions.pollId, pollId),
            eq(pollSubmissions.userId, userId),
          ),
        )
        .get()) ?? null
    );
  },

  async createSubmission(
    d1: D1Database,
    input: {
      id: string;
      pollId: string;
      userId: string;
      selectedChoice: string;
      createdAt: string;
    },
  ) {
    const db = createDb(d1);
    await db.insert(pollSubmissions).values(input);
    return input.id;
  },

  async findSubmissionsByPoll(d1: D1Database, pollId: string) {
    const db = createDb(d1);
    return db
      .select()
      .from(pollSubmissions)
      .where(eq(pollSubmissions.pollId, pollId))
      .all();
  },
};

export type { Poll, PollSubmission };

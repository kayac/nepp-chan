import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import {
  dataRetentionLogs,
  mastraMessages,
  mastraResources,
  mastraThreads,
  messageFeedback,
  pollSubmissions,
  polls,
  threadPersonaStatus,
} from "~/db";

const { testDbHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
}));

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return {
    ...actual,
    createDb: () => testDbHolder.db,
  };
});

vi.mock("~/lib/logger", () => ({
  logger: loggerMock,
}));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));

const { runDataRetention } = await import("./data-retention");

const env = { DB: {} as D1Database } as unknown as CloudflareBindings;

const NOW = new Date("2026-05-13T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();

describe("runDataRetention", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    testDbHolder.db = await createTestDb();
  });

  it("mastra_messages のうち 30 日より前のものだけ削除する", async () => {
    const db = testDbHolder.db as TestDb;
    await db.insert(mastraMessages).values([
      { id: "old", threadId: "t1", createdAt: daysAgo(31) },
      { id: "boundary-in", threadId: "t1", createdAt: daysAgo(29) },
      { id: "fresh", threadId: "t1", createdAt: daysAgo(1) },
    ]);

    await runDataRetention(env, { now: NOW });

    const remaining = await db.select().from(mastraMessages);
    expect(remaining.map((r) => r.id).sort()).toEqual(["boundary-in", "fresh"]);
  });

  it("mastra_messages 削除後に紐づきが無くなった古い mastra_threads を削除する", async () => {
    const db = testDbHolder.db as TestDb;
    await db.insert(mastraThreads).values([
      { id: "orphan", resourceId: "r1", createdAt: daysAgo(31) },
      { id: "alive", resourceId: "r2", createdAt: daysAgo(31) },
    ]);
    await db.insert(mastraMessages).values([
      { id: "m-old", threadId: "orphan", createdAt: daysAgo(31) },
      { id: "m-keep", threadId: "alive", createdAt: daysAgo(1) },
    ]);

    await runDataRetention(env, { now: NOW });

    const threads = await db.select().from(mastraThreads);
    expect(threads.map((t) => t.id)).toEqual(["alive"]);
  });

  it("作成30日以内の空 mastra_threads は削除しない（猶予期間）", async () => {
    const db = testDbHolder.db as TestDb;
    await db.insert(mastraThreads).values([
      { id: "new-empty", resourceId: "r1", createdAt: daysAgo(1) },
      { id: "old-empty", resourceId: "r2", createdAt: daysAgo(31) },
    ]);

    await runDataRetention(env, { now: NOW });

    const threads = await db.select().from(mastraThreads);
    expect(threads.map((t) => t.id)).toEqual(["new-empty"]);
  });

  it("mastra_messages 削除後に thread_persona_status.last_message_count を実数に再計算する", async () => {
    const db = testDbHolder.db as TestDb;
    await db.insert(mastraThreads).values({
      id: "t-active",
      resourceId: "r1",
      createdAt: daysAgo(1),
    });
    // 古い 2 件は削除される、新しい 3 件は残る → 実数 3 件になる
    await db.insert(mastraMessages).values([
      { id: "m-old1", threadId: "t-active", createdAt: daysAgo(31) },
      { id: "m-old2", threadId: "t-active", createdAt: daysAgo(31) },
      { id: "m-new1", threadId: "t-active", createdAt: daysAgo(1) },
      { id: "m-new2", threadId: "t-active", createdAt: daysAgo(1) },
      { id: "m-new3", threadId: "t-active", createdAt: daysAgo(1) },
    ]);
    await db.insert(threadPersonaStatus).values({
      threadId: "t-active",
      lastExtractedAt: daysAgo(15),
      lastMessageCount: 5, // 削除前の総数
    });

    await runDataRetention(env, { now: NOW });

    const status = await db.select().from(threadPersonaStatus).get();
    expect(status?.lastMessageCount).toBe(3);
  });

  it("mastra_threads 削除後に紐づかなくなった thread_persona_status を削除する", async () => {
    const db = testDbHolder.db as TestDb;
    await db.insert(threadPersonaStatus).values([
      {
        threadId: "ghost",
        lastExtractedAt: daysAgo(60),
        lastMessageCount: 3,
      },
      {
        threadId: "alive",
        lastExtractedAt: daysAgo(1),
        lastMessageCount: 2,
      },
    ]);
    await db.insert(mastraThreads).values({
      id: "alive",
      resourceId: "r1",
      createdAt: daysAgo(1),
    });

    await runDataRetention(env, { now: NOW });

    const remaining = await db.select().from(threadPersonaStatus);
    expect(remaining.map((r) => r.threadId)).toEqual(["alive"]);
  });

  it("mastra_resources のうち updatedAt が 180 日より前のものだけ削除する", async () => {
    const db = testDbHolder.db as TestDb;
    await db.insert(mastraResources).values([
      { id: "dormant", updatedAt: daysAgo(181) },
      { id: "boundary-in", updatedAt: daysAgo(179) },
      { id: "active", updatedAt: daysAgo(1) },
    ]);

    await runDataRetention(env, { now: NOW });

    const remaining = await db.select().from(mastraResources);
    expect(remaining.map((r) => r.id).sort()).toEqual([
      "active",
      "boundary-in",
    ]);
  });

  it("message_feedback のうち 180 日より前のものだけ削除する", async () => {
    const db = testDbHolder.db as TestDb;
    await db.insert(messageFeedback).values([
      {
        id: "old",
        threadId: "t1",
        messageId: "m1",
        rating: "good",
        conversationContext: "[]",
        createdAt: daysAgo(181),
      },
      {
        id: "fresh",
        threadId: "t1",
        messageId: "m2",
        rating: "bad",
        conversationContext: "[]",
        createdAt: daysAgo(1),
      },
    ]);

    await runDataRetention(env, { now: NOW });

    const remaining = await db.select().from(messageFeedback);
    expect(remaining.map((r) => r.id)).toEqual(["fresh"]);
  });

  it("poll_submissions のうち 365 日より前のものだけ削除する", async () => {
    const db = testDbHolder.db as TestDb;
    await db.insert(polls).values({
      id: "p1",
      title: "x",
      choices: "[]",
      createdBy: "admin",
      createdAt: daysAgo(1),
    });
    await db.insert(pollSubmissions).values([
      {
        id: "old",
        pollId: "p1",
        userId: "u1",
        selectedChoice: "a",
        createdAt: daysAgo(366),
      },
      {
        id: "fresh",
        pollId: "p1",
        userId: "u2",
        selectedChoice: "b",
        createdAt: daysAgo(1),
      },
    ]);

    await runDataRetention(env, { now: NOW });

    const remaining = await db.select().from(pollSubmissions);
    expect(remaining.map((r) => r.id)).toEqual(["fresh"]);
  });

  it("data_retention_logs のうち 1095 日より前のものを自身も削除する", async () => {
    const db = testDbHolder.db as TestDb;
    await db.insert(dataRetentionLogs).values([
      {
        id: "ancient",
        executedAt: daysAgo(1096),
        targetTable: "mastra_messages",
        deletedCount: 0,
        createdAt: daysAgo(1096),
      },
      {
        id: "keep",
        executedAt: daysAgo(1094),
        targetTable: "mastra_messages",
        deletedCount: 0,
        createdAt: daysAgo(1094),
      },
    ]);

    await runDataRetention(env, { now: NOW });

    const logs = await db.select().from(dataRetentionLogs);
    expect(logs.find((l) => l.id === "ancient")).toBeUndefined();
    expect(logs.find((l) => l.id === "keep")).toBeDefined();
  });

  it("削除件数を data_retention_logs に対象テーブルごとに記録する", async () => {
    const db = testDbHolder.db as TestDb;
    await db.insert(mastraMessages).values([
      { id: "m-old1", threadId: "t1", createdAt: daysAgo(31) },
      { id: "m-old2", threadId: "t1", createdAt: daysAgo(31) },
    ]);

    await runDataRetention(env, { now: NOW });

    const logs = await db
      .select()
      .from(dataRetentionLogs)
      .where(eq(dataRetentionLogs.executedAt, NOW.toISOString()));

    const byTable = Object.fromEntries(
      logs.map((l) => [l.targetTable, l.deletedCount]),
    );
    expect(byTable.mastra_messages).toBe(2);
    expect(byTable.mastra_resources).toBe(0);
    expect(byTable.message_feedback).toBe(0);
    expect(byTable.poll_submissions).toBe(0);
    expect(byTable.mastra_threads).toBe(0);
    expect(byTable.thread_persona_status).toBe(0);
    expect(byTable.data_retention_logs).toBe(0);
  });

  it("削除対象 0 件のテーブルについても log を残す", async () => {
    await runDataRetention(env, { now: NOW });

    const db = testDbHolder.db as TestDb;
    const logs = await db.select().from(dataRetentionLogs);

    const tables = new Set(logs.map((l) => l.targetTable));
    expect(tables).toEqual(
      new Set([
        "mastra_messages",
        "mastra_threads",
        "thread_persona_status",
        "mastra_resources",
        "message_feedback",
        "poll_submissions",
        "data_retention_logs",
      ]),
    );
    expect(logs.every((l) => l.deletedCount === 0)).toBe(true);
  });

  it("結果配列を返す", async () => {
    const results = await runDataRetention(env, { now: NOW });

    expect(results).toEqual([
      { table: "mastra_messages", deletedCount: 0 },
      { table: "mastra_threads", deletedCount: 0 },
      { table: "thread_persona_status", deletedCount: 0 },
      { table: "mastra_resources", deletedCount: 0 },
      { table: "message_feedback", deletedCount: 0 },
      { table: "poll_submissions", deletedCount: 0 },
      { table: "data_retention_logs", deletedCount: 0 },
    ]);
  });

  it("DB エラー時は logger.error を呼んで throw する", async () => {
    testDbHolder.db = {
      select: () => {
        throw new Error("DB down");
      },
    } as unknown as TestDb;

    await expect(runDataRetention(env, { now: NOW })).rejects.toThrow(
      "DB down",
    );
    expect(loggerMock.error).toHaveBeenCalled();
  });
});

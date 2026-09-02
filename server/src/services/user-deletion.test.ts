import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import {
  mastraMessages,
  mastraResources,
  mastraThreads,
  messageFeedback,
  persona,
  pollSubmissions,
  polls,
  retrievalRuns,
  reviewDecisions,
  threadPersonaStatus,
  userBroadcastState,
  userPollState,
} from "~/db";
import { hmacSha256 } from "~/lib/crypto";

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

const { deleteAllByLineUserId } = await import("./user-deletion");

const SECRET = "test-secret";
const TARGET_USER_ID = "U-target";
const OTHER_USER_ID = "U-other";

const env = {
  DB: {} as D1Database,
  RESOURCE_ID_HASH_SECRET: SECRET,
} as unknown as CloudflareBindings;

const insertFixtures = async (
  db: TestDb,
  hashedTarget: string,
  hashedOther: string,
) => {
  const targetThreadId = `line-thread:${hashedTarget}`;
  const otherThreadId = `line-thread:${hashedOther}`;
  const targetResourceId = `line:${hashedTarget}`;
  const otherResourceId = `line:${hashedOther}`;

  await db.insert(mastraThreads).values([
    { id: targetThreadId, resourceId: targetResourceId },
    { id: otherThreadId, resourceId: otherResourceId },
  ]);
  await db.insert(mastraMessages).values([
    { id: "m1", threadId: targetThreadId },
    { id: "m2", threadId: targetThreadId },
    { id: "m3", threadId: otherThreadId },
  ]);
  await db
    .insert(mastraResources)
    .values([{ id: targetResourceId }, { id: otherResourceId }]);
  await db.insert(threadPersonaStatus).values([
    {
      threadId: targetThreadId,
      lastExtractedAt: "2025-01-01T00:00:00Z",
      lastMessageCount: 2,
    },
    {
      threadId: otherThreadId,
      lastExtractedAt: "2025-01-01T00:00:00Z",
      lastMessageCount: 5,
    },
  ]);
  await db.insert(messageFeedback).values([
    {
      id: "f1",
      threadId: targetThreadId,
      messageId: "m1",
      rating: "good",
      conversationContext: "[]",
      createdAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "f2",
      threadId: otherThreadId,
      messageId: "m3",
      rating: "bad",
      conversationContext: "[]",
      createdAt: "2025-01-01T00:00:00Z",
    },
  ]);
  await db.insert(polls).values({
    id: "p1",
    title: "t",
    choices: '["a","b"]',
    createdBy: "admin",
    createdAt: "2025-01-01T00:00:00Z",
  });
  await db.insert(pollSubmissions).values([
    {
      id: "ps1",
      pollId: "p1",
      userId: hashedTarget,
      selectedChoice: "a",
      createdAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "ps2",
      pollId: "p1",
      userId: hashedOther,
      selectedChoice: "b",
      createdAt: "2025-01-01T00:00:00Z",
    },
  ]);
  await db.insert(userBroadcastState).values([
    { userId: hashedTarget, lastInjectedAt: "2025-01-01T00:00:00Z" },
    { userId: hashedOther, lastInjectedAt: "2025-01-01T00:00:00Z" },
  ]);
  await db.insert(userPollState).values([
    { userId: hashedTarget, lastInjectedAt: "2025-01-01T00:00:00Z" },
    { userId: hashedOther, lastInjectedAt: "2025-01-01T00:00:00Z" },
  ]);
  await db.insert(retrievalRuns).values([
    {
      id: "rr1",
      answerRunId: "ar1",
      threadId: targetThreadId,
      query: "水道 故障",
      hits: "[]",
      createdAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "rr2",
      answerRunId: "ar2",
      threadId: otherThreadId,
      query: "ゴミ 分別",
      hits: "[]",
      createdAt: "2025-01-01T00:00:00Z",
    },
  ]);
  await db.insert(reviewDecisions).values([
    {
      id: "rd1",
      answerRunId: "ar1",
      threadId: targetThreadId,
      decision: "no_issue",
      evidence: '{"question":"水道の相談"}',
      reviewedBy: "admin-1",
      createdAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "rd2",
      answerRunId: "ar2",
      threadId: otherThreadId,
      decision: "no_issue",
      reviewedBy: "admin-1",
      createdAt: "2025-01-01T00:00:00Z",
    },
  ]);
  // persona は削除対象外（個人データ非該当）
  await db.insert(persona).values({
    id: "pe1",
    category: "cat",
    content: "c",
    createdAt: "2025-01-01T00:00:00Z",
  });
};

describe("deleteAllByLineUserId", () => {
  let hashedTarget: string;
  let hashedOther: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDbHolder.db = await createTestDb();
    hashedTarget = await hmacSha256(TARGET_USER_ID, SECRET);
    hashedOther = await hmacSha256(OTHER_USER_ID, SECRET);
    await insertFixtures(testDbHolder.db, hashedTarget, hashedOther);
  });

  it("対象ユーザーの全関連レコードを削除する（thread / message / resource / persona_status / feedback / poll_submission / state 系）", async () => {
    await deleteAllByLineUserId(env, TARGET_USER_ID);

    const db = testDbHolder.db as TestDb;
    const targetThreadId = `line-thread:${hashedTarget}`;
    const targetResourceId = `line:${hashedTarget}`;

    expect(
      await db
        .select()
        .from(mastraThreads)
        .where(eq(mastraThreads.id, targetThreadId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(mastraMessages)
        .where(eq(mastraMessages.threadId, targetThreadId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(mastraResources)
        .where(eq(mastraResources.id, targetResourceId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(threadPersonaStatus)
        .where(eq(threadPersonaStatus.threadId, targetThreadId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(messageFeedback)
        .where(eq(messageFeedback.threadId, targetThreadId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(pollSubmissions)
        .where(eq(pollSubmissions.userId, hashedTarget)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(userBroadcastState)
        .where(eq(userBroadcastState.userId, hashedTarget)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(userPollState)
        .where(eq(userPollState.userId, hashedTarget)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(retrievalRuns)
        .where(eq(retrievalRuns.threadId, targetThreadId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(reviewDecisions)
        .where(eq(reviewDecisions.threadId, targetThreadId)),
    ).toHaveLength(0);
  });

  it("他ユーザーのレコードは残る", async () => {
    await deleteAllByLineUserId(env, TARGET_USER_ID);

    const db = testDbHolder.db as TestDb;
    const otherThreadId = `line-thread:${hashedOther}`;
    const otherResourceId = `line:${hashedOther}`;

    expect(await db.select().from(mastraThreads)).toHaveLength(1);
    expect(
      await db
        .select()
        .from(mastraThreads)
        .where(eq(mastraThreads.id, otherThreadId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(mastraMessages)
        .where(eq(mastraMessages.threadId, otherThreadId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(mastraResources)
        .where(eq(mastraResources.id, otherResourceId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(threadPersonaStatus)
        .where(eq(threadPersonaStatus.threadId, otherThreadId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(messageFeedback)
        .where(eq(messageFeedback.threadId, otherThreadId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(pollSubmissions)
        .where(eq(pollSubmissions.userId, hashedOther)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(userBroadcastState)
        .where(eq(userBroadcastState.userId, hashedOther)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(userPollState)
        .where(eq(userPollState.userId, hashedOther)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(retrievalRuns)
        .where(eq(retrievalRuns.threadId, otherThreadId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(reviewDecisions)
        .where(eq(reviewDecisions.threadId, otherThreadId)),
    ).toHaveLength(1);
  });

  it("persona テーブルは削除されない（個人データ非該当）", async () => {
    await deleteAllByLineUserId(env, TARGET_USER_ID);

    const db = testDbHolder.db as TestDb;
    expect(await db.select().from(persona)).toHaveLength(1);
  });

  it("成功時に user_data_deleted イベントを件数つきでログ出力し、userId 平文を含まない", async () => {
    await deleteAllByLineUserId(env, TARGET_USER_ID);

    const infoCalls = loggerMock.info.mock.calls;
    const deletedCall = infoCalls.find((c) =>
      JSON.stringify(c).includes("user_data_deleted"),
    );
    expect(
      deletedCall,
      "user_data_deleted ログが出力されていない",
    ).toBeDefined();

    expect(JSON.stringify(deletedCall)).not.toContain(TARGET_USER_ID);

    const payload = deletedCall?.[1] as Record<string, unknown> | undefined;
    expect(payload).toEqual(
      expect.objectContaining({
        event: "user_data_deleted",
        mastra_threads_deleted: 1,
        mastra_messages_deleted: 2,
        mastra_resources_deleted: 1,
        thread_persona_status_deleted: 1,
        message_feedback_deleted: 1,
        poll_submissions_deleted: 1,
        user_broadcast_state_deleted: 1,
        user_poll_state_deleted: 1,
        retrieval_runs_deleted: 1,
        review_decisions_deleted: 1,
      }),
    );
  });

  it("DB エラー時は logger.error を呼んで throw する", async () => {
    const brokenDb = {
      select: () => {
        throw new Error("DB down");
      },
    };
    testDbHolder.db = brokenDb as unknown as TestDb;

    await expect(deleteAllByLineUserId(env, TARGET_USER_ID)).rejects.toThrow(
      "DB down",
    );
    expect(loggerMock.error).toHaveBeenCalled();
    expect(JSON.stringify(loggerMock.error.mock.calls)).not.toContain(
      TARGET_USER_ID,
    );
  });
});

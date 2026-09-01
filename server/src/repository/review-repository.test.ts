import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { llmUsage, messageFeedback, retrievalRuns } from "~/db";

const { testDbHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
}));

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return {
    ...actual,
    createDb: () => testDbHolder.db,
  };
});

const { reviewRepository } = await import("./review-repository");

const d1 = {} as D1Database;

let runSeq = 0;
const insertRun = (values: {
  answerRunId: string;
  hits?: string;
  threadId?: string;
  messageId?: string | null;
  turnIndex?: number;
  createdAt?: string;
  query?: string;
}) => {
  runSeq += 1;
  const db = testDbHolder.db as TestDb;
  return db.insert(retrievalRuns).values({
    id: `run-${runSeq}`,
    answerRunId: values.answerRunId,
    threadId: values.threadId ?? "thread-1",
    messageId: values.messageId ?? null,
    turnIndex: values.turnIndex ?? 1,
    query: values.query ?? "q",
    hits: values.hits ?? "[]",
    createdAt: values.createdAt ?? "2026-09-01T00:00:00.000Z",
  });
};

const insertBadFeedback = (messageId: string) => {
  const db = testDbHolder.db as TestDb;
  return db.insert(messageFeedback).values({
    id: `fb-${messageId}`,
    threadId: "thread-1",
    messageId,
    rating: "bad",
    conversationContext: "{}",
    createdAt: "2026-09-01T00:00:00.000Z",
  });
};

const insertWebUsage = (threadId: string, turnIndex: number) => {
  const db = testDbHolder.db as TestDb;
  return db.insert(llmUsage).values({
    id: crypto.randomUUID(),
    model: "gemini",
    source: "subagent",
    agent: "web-researcher",
    threadId,
    turnIndex,
    createdAt: "2026-09-01T00:00:00.000Z",
  });
};

const hit = JSON.stringify([{ source: "a.md", score: 0.9 }]);

describe("reviewRepository.listQueue", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
    runSeq = 0;
  });

  it("0 件検索の answer run を zeroHit として返す", async () => {
    await insertRun({ answerRunId: "ar-1", hits: "[]" });

    const result = await reviewRepository.listQueue(d1, { limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      answerRunId: "ar-1",
      totalHits: 0,
      webFallback: 0,
      feedbackId: null,
    });
  });

  it("ヒットありでシグナルの無い answer run は返さない", async () => {
    await insertRun({ answerRunId: "ar-1", hits: hit });

    const result = await reviewRepository.listQueue(d1, { limit: 10 });
    expect(result.items).toHaveLength(0);
  });

  it("bad feedback が付いた answer run を返す", async () => {
    await insertRun({ answerRunId: "ar-1", hits: hit, messageId: "msg-1" });
    await insertBadFeedback("msg-1");

    const result = await reviewRepository.listQueue(d1, { limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].feedbackId).toBe("fb-msg-1");
  });

  it("web-researcher が同ターンで動いた answer run を webFallback として返す", async () => {
    await insertRun({ answerRunId: "ar-1", hits: hit, turnIndex: 2 });
    await insertWebUsage("thread-1", 2);

    const result = await reviewRepository.listQueue(d1, { limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].webFallback).toBe(1);
  });

  it("同一 answer run の複数検索を 1 行に集約する", async () => {
    await insertRun({ answerRunId: "ar-1", hits: "[]", query: "q1" });
    await insertRun({ answerRunId: "ar-1", hits: "[]", query: "q2" });

    const result = await reviewRepository.listQueue(d1, { limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].searchCount).toBe(2);
    expect(JSON.parse(result.items[0].queries)).toEqual(["q1", "q2"]);
  });

  it("decided=false は判断済みを除外する", async () => {
    await insertRun({ answerRunId: "ar-decided", hits: "[]" });
    await insertRun({ answerRunId: "ar-open", hits: "[]" });
    await reviewRepository.insertDecision(d1, {
      id: "dec-1",
      answerRunId: "ar-decided",
      decision: "no_issue",
      reviewedBy: "admin-1",
      createdAt: "2026-09-02T00:00:00.000Z",
    });

    const result = await reviewRepository.listQueue(d1, {
      limit: 10,
      decided: false,
    });

    expect(result.items.map((i) => i.answerRunId)).toEqual(["ar-open"]);
  });

  it("cursor で作成日時の古い側へページングする", async () => {
    await insertRun({
      answerRunId: "ar-new",
      hits: "[]",
      createdAt: "2026-09-02T00:00:00.000Z",
    });
    await insertRun({
      answerRunId: "ar-old",
      hits: "[]",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    const first = await reviewRepository.listQueue(d1, { limit: 1 });
    expect(first.items[0].answerRunId).toBe("ar-new");
    expect(first.hasMore).toBe(true);

    const second = await reviewRepository.listQueue(d1, {
      limit: 1,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items[0].answerRunId).toBe("ar-old");
    expect(second.hasMore).toBe(false);
  });
});

describe("reviewRepository decisions", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
    runSeq = 0;
  });

  it("判断を記録して新しい順に取得できる", async () => {
    await reviewRepository.insertDecision(d1, {
      id: "dec-1",
      answerRunId: "ar-1",
      decision: "no_issue",
      reviewedBy: "admin-1",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    await reviewRepository.insertDecision(d1, {
      id: "dec-2",
      answerRunId: "ar-1",
      decision: "incorrect",
      comment: "時刻が古い",
      reviewedBy: "admin-2",
      createdAt: "2026-09-02T00:00:00.000Z",
    });

    const decisions = await reviewRepository.listDecisions(d1, "ar-1");
    expect(decisions.map((d) => d.id)).toEqual(["dec-2", "dec-1"]);
    expect(decisions[0].comment).toBe("時刻が古い");
  });

  it("hasWebFallback は turnIndex が null なら false", async () => {
    expect(await reviewRepository.hasWebFallback(d1, "thread-1", null)).toBe(
      false,
    );
  });

  it("hasWebFallback は該当 usage があれば true", async () => {
    await insertWebUsage("thread-1", 3);
    expect(await reviewRepository.hasWebFallback(d1, "thread-1", 3)).toBe(true);
    expect(await reviewRepository.hasWebFallback(d1, "thread-1", 4)).toBe(
      false,
    );
  });
});

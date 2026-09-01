import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { retrievalRuns } from "~/db";

const { testDbHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
}));

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
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

const {
  recordRetrievalRun,
  recordRetrievalRunInBackground,
  linkRetrievalRunsToMessage,
} = await import("./retrieval-trace");

const d1 = {} as D1Database;

const buildContext = (values: Record<string, unknown> = {}) => {
  const context = new RequestContext();
  context.set("db", d1);
  for (const [key, value] of Object.entries(values)) {
    context.set(key, value);
  }
  return context;
};

describe("recordRetrievalRun", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    vi.clearAllMocks();
  });

  it("検索結果を requestContext の属性とともに保存する", async () => {
    const context = buildContext({
      answerRunId: "run-1",
      usageThreadId: "thread-1",
      usageTurnIndex: 3,
    });

    await recordRetrievalRun(context, {
      query: "村営バスの時刻",
      durationMs: 120,
      hits: [
        {
          source: "bus/index.md",
          title: "村営バス",
          section: "時刻表",
          score: 0.82,
          rerankScore: 0.9,
          contentHash: "abc123",
        },
      ],
    });

    const rows = await db.select().from(retrievalRuns).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      answerRunId: "run-1",
      threadId: "thread-1",
      messageId: null,
      turnIndex: 3,
      query: "村営バスの時刻",
      durationMs: 120,
    });
    expect(JSON.parse(rows[0].hits)).toEqual([
      {
        source: "bus/index.md",
        title: "村営バス",
        section: "時刻表",
        score: 0.82,
        rerankScore: 0.9,
        contentHash: "abc123",
      },
    ]);
  });

  it("0 件の検索も hits 空配列で保存する", async () => {
    await recordRetrievalRun(buildContext({ answerRunId: "run-1" }), {
      query: "存在しない情報",
      hits: [],
    });

    const rows = await db.select().from(retrievalRuns).all();
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].hits)).toEqual([]);
  });

  it("requestContext に db が無ければ何もしない", async () => {
    await recordRetrievalRun(new RequestContext(), {
      query: "foo",
      hits: [],
    });

    const rows = await db.select().from(retrievalRuns).all();
    expect(rows).toHaveLength(0);
  });

  it("保存に失敗しても throw せず警告ログを残す", async () => {
    testDbHolder.db = null;

    await expect(
      recordRetrievalRun(buildContext(), { query: "foo", hits: [] }),
    ).resolves.toBeUndefined();
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});

describe("linkRetrievalRunsToMessage", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    vi.clearAllMocks();
  });

  const insertRun = (values: {
    id: string;
    answerRunId: string;
    messageId?: string;
  }) =>
    db.insert(retrievalRuns).values({
      id: values.id,
      answerRunId: values.answerRunId,
      messageId: values.messageId,
      query: "q",
      hits: "[]",
      createdAt: new Date().toISOString(),
    });

  it("同じ answer run の全検索行に message_id を後埋めする", async () => {
    await insertRun({ id: "r1", answerRunId: "run-1" });
    await insertRun({ id: "r2", answerRunId: "run-1" });
    await insertRun({ id: "r3", answerRunId: "run-2" });

    await linkRetrievalRunsToMessage(
      buildContext({ answerRunId: "run-1" }),
      "msg-1",
    );

    const rows = await db.select().from(retrievalRuns).all();
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.messageId]));
    expect(byId).toEqual({ r1: "msg-1", r2: "msg-1", r3: null });
  });

  it("既に message_id が入っている行は上書きしない", async () => {
    await insertRun({ id: "r1", answerRunId: "run-1", messageId: "msg-old" });

    await linkRetrievalRunsToMessage(
      buildContext({ answerRunId: "run-1" }),
      "msg-new",
    );

    const rows = await db.select().from(retrievalRuns).all();
    expect(rows[0].messageId).toBe("msg-old");
  });

  it("未完了の保存があれば完了を待ってから紐付ける", async () => {
    const context = buildContext({
      answerRunId: "run-1",
      retrievalTracePending: [],
    });
    recordRetrievalRunInBackground(context, { query: "q", hits: [] });

    await linkRetrievalRunsToMessage(context, "msg-1");

    const rows = await db.select().from(retrievalRuns).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].messageId).toBe("msg-1");
  });

  it("answerRunId が無ければ何もしない", async () => {
    await insertRun({ id: "r1", answerRunId: "run-1" });

    await linkRetrievalRunsToMessage(buildContext(), "msg-1");

    const rows = await db.select().from(retrievalRuns).all();
    expect(rows[0].messageId).toBeNull();
  });

  it("更新に失敗しても throw せず警告ログを残す", async () => {
    testDbHolder.db = null;

    await expect(
      linkRetrievalRunsToMessage(
        buildContext({ answerRunId: "run-1" }),
        "msg-1",
      ),
    ).resolves.toBeUndefined();
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});

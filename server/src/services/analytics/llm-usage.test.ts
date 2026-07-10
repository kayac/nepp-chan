import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { llmUsage } from "~/db";

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

const { recordLlmUsage } = await import("./llm-usage");

const d1 = {} as D1Database;

describe("recordLlmUsage", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    vi.clearAllMocks();
  });

  it("usage を llm_usage に保存する", async () => {
    await recordLlmUsage(d1, {
      model: "gemini-2.5-flash",
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 30,
        cachedInputTokens: 10,
        totalTokens: 180,
      },
      platform: "web",
      source: "chat",
      intent: "thinking",
      threadId: "thread-1",
    });

    const rows = await db.select().from(llmUsage).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      model: "gemini-2.5-flash",
      inputTokens: 100,
      outputTokens: 50,
      reasoningTokens: 30,
      cachedInputTokens: 10,
      totalTokens: 180,
      platform: "web",
      source: "chat",
      intent: "thinking",
      threadId: "thread-1",
    });
    expect(rows[0]?.id).toBeTruthy();
    expect(rows[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("usage の欠損フィールドは 0、未指定の属性は null で保存する", async () => {
    await recordLlmUsage(d1, {
      model: "gemini-2.5-flash-lite",
      usage: { inputTokens: 10 },
      source: "persona-extract",
    });

    const rows = await db.select().from(llmUsage).all();
    expect(rows[0]).toMatchObject({
      inputTokens: 10,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      platform: null,
      intent: null,
      threadId: null,
    });
  });

  it("totalTokens が無ければ input/output/reasoning の合算で保存する", async () => {
    await recordLlmUsage(d1, {
      model: "gemini-2.5-flash",
      usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 30 },
      source: "chat",
    });

    const rows = await db.select().from(llmUsage).all();
    expect(rows[0]?.totalTokens).toBe(180);
  });

  it("platform: widget を保存できる", async () => {
    await recordLlmUsage(d1, {
      model: "gemini-2.5-flash",
      usage: { inputTokens: 1 },
      platform: "widget",
      source: "chat",
    });

    const rows = await db.select().from(llmUsage).all();
    expect(rows[0]).toMatchObject({ platform: "widget" });
  });

  it("usage 未取得（undefined）でも 0 埋めで保存する", async () => {
    await recordLlmUsage(d1, {
      model: "gemini-2.5-flash",
      usage: undefined,
      platform: "line",
      source: "chat",
    });

    const rows = await db.select().from(llmUsage).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.totalTokens).toBe(0);
  });

  it("insert に失敗しても throw せず warn ログを出す", async () => {
    testDbHolder.db = null; // createDb が null を返し insert で落ちる状況を作る

    await expect(
      recordLlmUsage(d1, {
        model: "gemini-2.5-flash",
        usage: { inputTokens: 1 },
        source: "chat",
      }),
    ).resolves.toBeUndefined();
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});

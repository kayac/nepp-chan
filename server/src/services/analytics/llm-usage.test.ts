import { RequestContext } from "@mastra/core/request-context";
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

const { askJevMock } = vi.hoisted(() => ({ askJevMock: vi.fn() }));

vi.mock("~/lib/jev", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/jev")>()),
  askJev: askJevMock,
}));

const { askJevWithUsage, recordLlmUsage, usageRecordingOptions } = await import(
  "./llm-usage"
);

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

  it("totalTokens が無ければ input と output（reasoning 込み）の合算で保存する", async () => {
    await recordLlmUsage(d1, {
      model: "gemini-2.5-flash",
      usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 30 },
      source: "chat",
    });

    const rows = await db.select().from(llmUsage).all();
    expect(rows[0]?.totalTokens).toBe(150);
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

  it("記録時点の単価で costUsd を永続化する", async () => {
    await recordLlmUsage(d1, {
      model: "openai/gpt-5.6-luna",
      usage: {
        inputTokens: 1_000_000,
        cachedInputTokens: 500_000,
        outputTokens: 1_000_000,
      },
      source: "chat",
    });

    const rows = await db.select().from(llmUsage).all();
    // 非キャッシュ入力 $0.10 + キャッシュ入力 $0.01 + 出力 $1.20
    expect(rows[0]?.costUsd).toBeCloseTo(1.31, 10);
  });

  it("未知のモデルは costUsd 0 で保存する", async () => {
    await recordLlmUsage(d1, {
      model: "unknown-model",
      usage: { inputTokens: 1_000_000 },
      source: "chat",
    });

    const rows = await db.select().from(llmUsage).all();
    expect(rows[0]?.costUsd).toBe(0);
  });

  it("platform: voice を保存できる", async () => {
    await recordLlmUsage(d1, {
      model: "openai/gpt-5.6-luna",
      usage: { inputTokens: 1 },
      platform: "voice",
      source: "chat",
    });

    const rows = await db.select().from(llmUsage).all();
    expect(rows[0]).toMatchObject({ platform: "voice" });
  });

  it("NaN の usage（Google embedding 等）は 0 に正規化して保存する", async () => {
    await recordLlmUsage(d1, {
      model: "gemini-embedding-001",
      usage: { inputTokens: Number.NaN, totalTokens: Number.NaN },
      source: "embedding",
    });

    const rows = await db.select().from(llmUsage).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      inputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
    });
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

describe("usageRecordingOptions", () => {
  let db: TestDb;

  const buildContext = (values: Record<string, unknown>) => {
    const store = new Map(Object.entries(values));
    return {
      get: (key: string) => store.get(key),
    } as unknown as import("@mastra/core/request-context").RequestContext;
  };

  const finishEvent = (overrides: Record<string, unknown> = {}) =>
    ({
      totalUsage: { inputTokens: 100, outputTokens: 50 },
      model: { modelId: "openai/gpt-5.6-luna" },
      ...overrides,
    }) as never;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    vi.clearAllMocks();
  });

  it("onFinish が requestContext の db・platform・threadId で記録する", async () => {
    const requestContext = buildContext({
      db: {} as D1Database,
      usagePlatform: "line",
      usageThreadId: "thread-9",
    });
    const options = usageRecordingOptions({
      source: "subagent",
      fallbackModel: "openai/gpt-5.6-luna",
    })({ requestContext });

    await options.onFinish(finishEvent());

    const rows = await db.select().from(llmUsage).all();
    expect(rows[0]).toMatchObject({
      model: "openai/gpt-5.6-luna",
      inputTokens: 100,
      outputTokens: 50,
      platform: "line",
      source: "subagent",
      threadId: "thread-9",
    });
  });

  it("event に model が無ければ fallbackModel で記録する", async () => {
    const requestContext = buildContext({ db: {} as D1Database });
    const options = usageRecordingOptions({
      source: "intent-classify",
      fallbackModel: "openai/gpt-4.1-nano",
    })({ requestContext });

    await options.onFinish(finishEvent({ model: undefined }));

    const rows = await db.select().from(llmUsage).all();
    expect(rows[0]).toMatchObject({
      model: "openai/gpt-4.1-nano",
      source: "intent-classify",
      platform: null,
      threadId: null,
    });
  });

  it("requestContext に db が無ければ何もしない", async () => {
    const options = usageRecordingOptions({
      source: "subagent",
      fallbackModel: "openai/gpt-5.6-luna",
    })({ requestContext: undefined });

    await options.onFinish(finishEvent());

    const rows = await db.select().from(llmUsage).all();
    expect(rows).toHaveLength(0);
  });

  it("defaults（providerOptions 等）を維持したまま onFinish を付与する", () => {
    const defaults = {
      providerOptions: { openai: { reasoningEffort: "low" } },
    };
    const options = usageRecordingOptions({
      source: "subagent",
      fallbackModel: "openai/gpt-5.6-luna",
      defaults,
    })({ requestContext: undefined });

    expect(options.providerOptions).toEqual(defaults.providerOptions);
    expect(typeof options.onFinish).toBe("function");
  });
});

describe("askJevWithUsage", () => {
  let db: TestDb;

  const contextWithDb = () => {
    const ctx = new RequestContext();
    ctx.set("db", d1);
    return ctx;
  };

  const question = { type: "noul" as const, instructions: "Relevant?" };

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
    askJevMock.mockReset();
  });

  it("jev の応答を返し、model・トークン数・所要時間を source・agent 付きで記録する", async () => {
    const response = {
      model: "jev-1.13.0",
      answers: { q: { type: "noul", noul: 0.8 } },
      usage: { input_tokens: 680, output_tokens: 0 },
    };
    askJevMock.mockResolvedValueOnce(response);

    const result = await askJevWithUsage({
      apiKey: "k",
      state: "x",
      questions: { q: question },
      requestContext: contextWithDb(),
      source: "rerank",
      agent: "knowledge-reranker",
    });

    expect(result).toBe(response);
    expect(askJevMock).toHaveBeenCalledWith({
      apiKey: "k",
      state: "x",
      questions: { q: question },
    });
    await vi.waitFor(async () => {
      const rows = await db.select().from(llmUsage).all();
      expect(rows[0]).toMatchObject({
        model: "jev-1.13.0",
        inputTokens: 680,
        outputTokens: 0,
        source: "rerank",
        agent: "knowledge-reranker",
      });
      expect(rows[0]?.durationMs).toEqual(expect.any(Number));
    });
  });

  it("応答に model が無ければ jev-latest で記録する", async () => {
    askJevMock.mockResolvedValueOnce({
      answers: { q: { type: "noul", noul: 0.8 } },
    });

    await askJevWithUsage({
      apiKey: "k",
      state: "x",
      questions: { q: question },
      requestContext: contextWithDb(),
      source: "intent-classify",
      agent: "intent-router",
    });

    await vi.waitFor(async () => {
      const rows = await db.select().from(llmUsage).all();
      expect(rows[0]?.model).toBe("jev-latest");
    });
  });

  it("jev が throw したら記録せずにそのまま throw する", async () => {
    askJevMock.mockRejectedValueOnce(new Error("jev responded 429"));

    await expect(
      askJevWithUsage({
        apiKey: "k",
        state: "x",
        questions: { q: question },
        requestContext: contextWithDb(),
        source: "rerank",
        agent: "knowledge-reranker",
      }),
    ).rejects.toThrow("jev responded 429");
    expect(await db.select().from(llmUsage).all()).toHaveLength(0);
  });
});

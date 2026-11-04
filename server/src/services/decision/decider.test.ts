import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { llmUsage } from "~/db";

const { testDbHolder, askJevMock } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
  askJevMock: vi.fn(),
}));

vi.mock("~/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/db")>()),
  createDb: () => testDbHolder.db,
}));

vi.mock("~/lib/jev", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/jev")>()),
  askJev: askJevMock,
}));

const { createDecider } = await import("./decider");

const d1 = {} as D1Database;

const contextWith = (key?: string) => {
  const ctx = new RequestContext();
  ctx.set("env", { TYPESAFE_API_KEY: key });
  ctx.set("db", d1);
  return ctx;
};

const usage = { source: "rerank", agent: "knowledge-reranker" } as const;

const colorQuestion = {
  type: "choice",
  instructions: "色を選ぶ",
  criteria: { red: "赤", blue: "青" },
} as const;

const relevantQuestion = {
  type: "yesno",
  instructions: "関係があるか",
  criteria: { true: "ある", false: "ない" },
} as const;

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
  testDbHolder.db = db;
  askJevMock.mockReset();
});

describe("createDecider", () => {
  it("TYPESAFE_API_KEY が無ければ判定器を作らない", () => {
    expect(createDecider(contextWith(), usage)).toBeUndefined();
    expect(createDecider(undefined, usage)).toBeUndefined();
  });
});

describe("decide", () => {
  it("yesno は jev の noul として送り、確率を p で返す", async () => {
    askJevMock.mockResolvedValueOnce({
      answers: { relevant: { type: "noul", noul: 0.8 } },
    });
    const decider = createDecider(contextWith("k"), usage);

    const answers = await decider?.decide(
      { query: "q" },
      { relevant: relevantQuestion },
    );

    expect(answers?.relevant.p).toBe(0.8);
    expect(askJevMock).toHaveBeenCalledWith({
      apiKey: "k",
      state: { query: "q" },
      questions: { relevant: { ...relevantQuestion, type: "noul" } },
    });
  });

  it("choice は選ばれた選択肢と全選択肢の確率を返す", async () => {
    askJevMock.mockResolvedValueOnce({
      answers: {
        color: {
          type: "choice",
          choice: "red",
          probabilities: { red: 0.7, blue: 0.3 },
        },
      },
    });
    const decider = createDecider(contextWith("k"), usage);

    const answers = await decider?.decide("x", { color: colorQuestion });

    expect(answers?.color).toEqual({
      choice: "red",
      probabilities: { red: 0.7, blue: 0.3 },
    });
    expect(askJevMock.mock.calls[0]?.[0].questions.color).toEqual(
      colorQuestion,
    );
  });

  it.each([
    ["回答が無い", {}],
    [
      "型が違う",
      {
        color: { type: "noul", noul: 0.5 },
        relevant: { type: "noul", noul: 1 },
      },
    ],
    [
      "選択肢に無い値を選んだ",
      {
        color: { type: "choice", choice: "green", probabilities: {} },
        relevant: { type: "noul", noul: 1 },
      },
    ],
    [
      "選択肢の確率が欠けている",
      {
        color: { type: "choice", choice: "red", probabilities: { red: 1 } },
        relevant: { type: "noul", noul: 1 },
      },
    ],
  ])("%s ときは throw する", async (_, answers) => {
    askJevMock.mockResolvedValueOnce({ answers });
    const decider = createDecider(contextWith("k"), usage);

    await expect(
      decider?.decide("x", {
        color: colorQuestion,
        relevant: relevantQuestion,
      }),
    ).rejects.toThrow();
  });

  it("model・トークン数・所要時間を source・agent 付きで記録する", async () => {
    askJevMock.mockResolvedValueOnce({
      model: "jev-1.13.0",
      answers: { relevant: { type: "noul", noul: 0.8 } },
      usage: { input_tokens: 680, output_tokens: 0 },
    });

    await createDecider(contextWith("k"), usage)?.decide("x", {
      relevant: relevantQuestion,
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
      answers: { relevant: { type: "noul", noul: 0.8 } },
    });

    await createDecider(contextWith("k"), usage)?.decide("x", {
      relevant: relevantQuestion,
    });

    await vi.waitFor(async () => {
      const rows = await db.select().from(llmUsage).all();
      expect(rows[0]?.model).toBe("jev-latest");
    });
  });

  it("jev が throw したら記録せずにそのまま throw する", async () => {
    askJevMock.mockRejectedValueOnce(new Error("jev responded 429"));

    await expect(
      createDecider(contextWith("k"), usage)?.decide("x", {
        relevant: relevantQuestion,
      }),
    ).rejects.toThrow("jev responded 429");
    expect(await db.select().from(llmUsage).all()).toHaveLength(0);
  });
});

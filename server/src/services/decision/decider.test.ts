import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  booleanAnswer,
  choiceAnswer,
  decision,
  doDecideMock,
} from "~/__tests__/helpers/jev-provider";
import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { llmUsage } from "~/db";

const { testDbHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
}));

vi.mock("~/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/db")>()),
  createDb: () => testDbHolder.db,
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock(
  "@ai-sdk/typesafe-ai",
  () => import("~/__tests__/helpers/jev-provider"),
);

const { decide } = await import("./decider");

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
  type: "boolean",
  instructions: "関係があるか",
  criteria: { true: "ある", false: "ない" },
} as const;

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
  testDbHolder.db = db;
  doDecideMock.mockReset();
});

describe("decide", () => {
  it("TYPESAFE_API_KEY が無ければ jev を呼ばずに undefined を返す", async () => {
    const questions = { relevant: relevantQuestion };
    expect(await decide(contextWith(), usage, "x", questions)).toBeUndefined();
    expect(await decide(undefined, usage, "x", questions)).toBeUndefined();
    expect(doDecideMock).not.toHaveBeenCalled();
  });

  it("boolean は確率を、choice は選ばれた選択肢と全選択肢の確率を返す", async () => {
    doDecideMock.mockResolvedValueOnce(
      decision({
        relevant: booleanAnswer(0.8),
        color: choiceAnswer("red", { red: 0.7, blue: 0.3 }),
      }),
    );

    const answers = await decide(contextWith("k"), usage, "x", {
      relevant: relevantQuestion,
      color: colorQuestion,
    });

    expect(answers?.relevant.probability).toBe(0.8);
    expect(answers?.color).toEqual({
      type: "choice",
      choice: "red",
      probabilities: { red: 0.7, blue: 0.3 },
    });
  });

  it("配列やオブジェクトの state は json パーツ、文字列は text パーツとして渡す", async () => {
    doDecideMock.mockResolvedValue(decision({ relevant: booleanAnswer(1) }));
    const ctx = contextWith("k");

    await decide(ctx, usage, [{ from: "user", text: "hi" }], {
      relevant: relevantQuestion,
    });
    await decide(ctx, usage, "plain", { relevant: relevantQuestion });

    expect(doDecideMock.mock.calls[0]?.[0]).toMatchObject({
      state: [{ type: "json", value: [{ from: "user", text: "hi" }] }],
      questions: { relevant: relevantQuestion },
    });
    expect(doDecideMock.mock.calls[1]?.[0].state).toEqual([
      { type: "text", text: "plain" },
    ]);
  });

  it("model・トークン数・所要時間を source・agent 付きで記録する", async () => {
    doDecideMock.mockResolvedValueOnce(
      decision(
        { relevant: booleanAnswer(0.8) },
        { modelId: "jev-1.13.0", usage: { inputTokens: 680, outputTokens: 0 } },
      ),
    );

    await decide(contextWith("k"), usage, "x", { relevant: relevantQuestion });

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

  it("jev が失敗したら記録せずに undefined を返す", async () => {
    doDecideMock.mockRejectedValueOnce(new Error("jev responded 429"));

    expect(
      await decide(contextWith("k"), usage, "x", {
        relevant: relevantQuestion,
      }),
    ).toBeUndefined();
    expect(await db.select().from(llmUsage).all()).toHaveLength(0);
  });
});

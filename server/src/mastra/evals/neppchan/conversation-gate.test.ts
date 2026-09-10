import type {
  ScorerRunInputForAgent,
  ScorerRunOutputForAgent,
} from "@mastra/core/evals";
import { createScorer } from "@mastra/core/evals";
import {
  createTestMessage,
  extractInputMessages,
} from "@mastra/evals/scorers/utils";
import { describe, expect, it } from "vitest";
import { conversationGates } from "./conversation-gate";

const output: ScorerRunOutputForAgent = [
  createTestMessage({ content: "本文だよ", role: "assistant" }),
];

const echoGate = createScorer({
  id: "code:echo",
  description: "受け取った input と output を返す",
  type: "agent",
})
  .preprocess(({ run }) => ({
    users: extractInputMessages(run.input),
    out: run.output,
  }))
  .generateScore(({ results }) =>
    results.preprocessStepResult.users.length === 3 ? 1 : 0,
  )
  .generateReason(({ results }) =>
    results.preprocessStepResult.users.join("|"),
  );

const boomGate = createScorer({
  id: "code:boom",
  description: "例外を投げる",
  type: "agent",
}).generateScore(() => {
  throw new Error("intentional");
});

const turns = ["一言目", "二言目", "三言目"];

// runEvals の per-turn gate は run.input に当該ターンの生文字列を渡す（型は inputMessages 形式のまま）
const turnInput = (text: string) => text as unknown as ScorerRunInputForAgent;

describe("conversationGates", () => {
  it("gate には全ターンの user メッセージを input として渡し、output はそのまま通す", async () => {
    const {
      scorers,
      outcomes,
      output: captured,
    } = conversationGates([echoGate], turns);
    const r = await scorers[0].run({ input: turnInput("三言目"), output });
    expect(r.score).toBe(1);
    expect(r.reason).toBe("一言目|二言目|三言目");
    expect(outcomes).toEqual([
      { id: "code:echo", passed: true, reason: "一言目|二言目|三言目" },
    ]);
    expect(captured()).toBe(output);
  });

  it("gate の例外は score 0 と reason に変えて runEvals に届ける", async () => {
    const { scorers, outcomes } = conversationGates([boomGate], turns);
    const r = await scorers[0].run({ input: turnInput("三言目"), output });
    expect(r.score).toBe(0);
    expect(outcomes).toEqual([
      {
        id: "code:boom",
        passed: false,
        reason: "scorer error: Scorer Run Failed: intentional",
      },
    ]);
  });

  it("元の gate と同じ id で runEvals に渡す", () => {
    const { scorers } = conversationGates([echoGate, boomGate], turns);
    expect(scorers.map((s) => s.id)).toEqual(["code:echo", "code:boom"]);
  });
});

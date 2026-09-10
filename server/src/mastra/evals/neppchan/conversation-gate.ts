import {
  createScorer,
  type ScorerRunInputForAgent,
  type ScorerRunOutputForAgent,
} from "@mastra/core/evals";
import { createTestMessage } from "@mastra/evals/scorers/utils";
import type { GateScorer } from "./schema";

export type GateOutcome = { id: string; passed: boolean; reason?: string };

// runEvals の per-turn gate が受ける run.input は当該ターンの生文字列で、前のターンは含まれない。
// 会話全体を見る judge のために input を全ターンの user メッセージに差し替え、
// runEvals が捨てる reason と scorer の例外もここで拾う
export const conversationGates = (
  gates: GateScorer[],
  turns: readonly string[],
) => {
  const input: ScorerRunInputForAgent = {
    inputMessages: turns.map((t) =>
      createTestMessage({ content: t, role: "user" }),
    ),
    rememberedMessages: [],
    systemMessages: [],
    taggedSystemMessages: {},
  };
  const outcomes: GateOutcome[] = [];
  let output: ScorerRunOutputForAgent = [];
  const scorers = gates.map((gate) =>
    createScorer({ id: gate.id, description: gate.description, type: "agent" })
      .preprocess(async ({ run }) => {
        output = run.output;
        try {
          const r = await gate.run({ ...run, input });
          const score = Number(r.score);
          const reason = typeof r.reason === "string" ? r.reason : undefined;
          outcomes.push({ id: gate.id, passed: score === 1, reason });
          return { score, reason };
        } catch (e) {
          const reason = `scorer error: ${e instanceof Error ? e.message : String(e)}`;
          outcomes.push({ id: gate.id, passed: false, reason });
          return { score: 0, reason };
        }
      })
      .generateScore(({ results }) => results.preprocessStepResult.score)
      .generateReason(({ results }) => results.preprocessStepResult.reason),
  );
  return { scorers, outcomes, output: () => output };
};

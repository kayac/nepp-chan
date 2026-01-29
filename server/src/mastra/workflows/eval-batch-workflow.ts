import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { testCases } from "~/mastra/data/eval-test-cases";

import {
  extractKnowledgeSearchResults,
  runEvalScorers,
} from "./utils/eval-helpers";

const batchResultSchema = z.object({
  results: z.any(),
  summary: z.object({
    totalCases: z.number(),
    averageScores: z.object({
      similarity: z.number(),
      faithfulness: z.number(),
      contextPrecision: z.number(),
      contextRelevance: z.number(),
      hallucination: z.number(),
    }),
    lowScoreCases: z.array(
      z.object({
        input: z.string(),
        scores: z.object({
          similarity: z.number(),
          faithfulness: z.number(),
          contextPrecision: z.number(),
          contextRelevance: z.number(),
          hallucination: z.number(),
        }),
      }),
    ),
  }),
});

const runBatchEval = createStep({
  id: "run-batch-eval",
  description: "Run evaluation for all predefined test cases",
  inputSchema: z.object({}),
  outputSchema: batchResultSchema,
  execute: async ({ mastra }) => {
    const agent = mastra?.getAgent("nepChanAgent");
    if (!agent) {
      throw new Error("nepChanAgent not found");
    }

    const results = await Promise.all(
      testCases.map(async (testCase) => {
        const result = await agent.generate(testCase.input);
        const retrievedChunks = extractKnowledgeSearchResults(result.steps);
        const scores = await runEvalScorers({
          input: testCase.input,
          output: result.text,
          groundTruth: testCase.groundTruth,
          context: retrievedChunks.map((c) => c.content),
        });

        return {
          input: testCase.input,
          groundTruth: testCase.groundTruth,
          answer: result.text,
          retrievedChunks,
          scores,
        };
      }),
    );

    // サマリー計算
    const calcAverage = (scores: number[]) =>
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    const averageScores = {
      similarity: calcAverage(results.map((r) => r.scores.similarity.score)),
      faithfulness: calcAverage(
        results.map((r) => r.scores.faithfulness.score),
      ),
      contextPrecision: calcAverage(
        results.map((r) => r.scores.contextPrecision.score),
      ),
      contextRelevance: calcAverage(
        results.map((r) => r.scores.contextRelevance.score),
      ),
      hallucination: calcAverage(
        results.map((r) => r.scores.hallucination.score),
      ),
    };

    // 低スコアケース（いずれかのスコアが 0.7 未満）
    const THRESHOLD = 0.7;
    const lowScoreCases = results
      .filter(
        (r) =>
          r.scores.similarity.score < THRESHOLD ||
          r.scores.faithfulness.score < THRESHOLD ||
          r.scores.contextPrecision.score < THRESHOLD ||
          r.scores.contextRelevance.score < THRESHOLD ||
          r.scores.hallucination.score < THRESHOLD,
      )
      .map((r) => ({
        input: r.input,
        scores: {
          similarity: r.scores.similarity.score,
          faithfulness: r.scores.faithfulness.score,
          contextPrecision: r.scores.contextPrecision.score,
          contextRelevance: r.scores.contextRelevance.score,
          hallucination: r.scores.hallucination.score,
        },
      }));

    return {
      results,
      summary: {
        totalCases: results.length,
        averageScores,
        lowScoreCases,
      },
    };
  },
});

const evalBatchWorkflow = createWorkflow({
  id: "eval-batch-workflow",
  inputSchema: z.object({}),
  outputSchema: batchResultSchema,
}).then(runBatchEval);

evalBatchWorkflow.commit();

export { evalBatchWorkflow };

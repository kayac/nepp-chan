import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { testCases } from "~/mastra/data/eval-test-cases";

import {
  type EvalResult,
  evalResultSchema,
  extractKnowledgeSearchResults,
  runEvalScorers,
} from "./utils/eval-helpers";

const batchResultSchema = z.object({
  results: z.array(evalResultSchema),
  summary: z.object({
    totalCases: z.number(),
    averageSimilarityScore: z.number(),
    averageFaithfulnessScore: z.number(),
    lowScoreCases: z.array(
      z.object({
        input: z.string(),
        similarityScore: z.number(),
        faithfulnessScore: z.number(),
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

    const results: EvalResult[] = [];

    for (const testCase of testCases) {
      const result = await agent.generate(testCase.input);
      const retrievedChunks = extractKnowledgeSearchResults(result.steps);
      const scores = await runEvalScorers({
        input: testCase.input,
        output: result.text,
        groundTruth: testCase.groundTruth,
        context: retrievedChunks.map((c) => c.content),
      });

      results.push({
        input: testCase.input,
        groundTruth: testCase.groundTruth,
        answer: result.text,
        retrievedChunks,
        scores,
      });
    }

    // サマリー計算
    const similarityScores = results.map((r) => r.scores.similarity.score);
    const faithfulnessScores = results.map((r) => r.scores.faithfulness.score);
    const averageSimilarityScore =
      similarityScores.length > 0
        ? similarityScores.reduce((a, b) => a + b, 0) / similarityScores.length
        : 0;
    const averageFaithfulnessScore =
      faithfulnessScores.length > 0
        ? faithfulnessScores.reduce((a, b) => a + b, 0) /
          faithfulnessScores.length
        : 0;

    // 低スコアケース（similarity または faithfulness が 0.7 未満）
    const lowScoreCases = results
      .filter(
        (r) =>
          r.scores.similarity.score < 0.7 || r.scores.faithfulness.score < 0.7,
      )
      .map((r) => ({
        input: r.input,
        similarityScore: r.scores.similarity.score,
        faithfulnessScore: r.scores.faithfulness.score,
      }));

    return {
      results,
      summary: {
        totalCases: results.length,
        averageSimilarityScore,
        averageFaithfulnessScore,
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

/**
 * RAG評価ワークフロー
 *
 * 5つの観点でRAGシステムの品質を評価:
 * - similarity: 回答が期待回答とどれだけ一致しているか
 * - faithfulness: 回答が取得コンテキストに忠実か
 * - contextPrecision: 関連コンテキストが検索上位にあるか
 * - contextRelevance: 取得コンテキストが質問に対して有用か
 * - hallucination: コンテキストにない情報を捏造していないか
 */
import { createStep, createWorkflow } from "@mastra/core/workflows";
import {
  createAnswerSimilarityScorer,
  createContextPrecisionScorer,
  createContextRelevanceScorerLLM,
  createFaithfulnessScorer,
  createHallucinationScorer,
} from "@mastra/evals/scorers/prebuilt";
import {
  createAgentTestRun,
  createTestMessage,
} from "@mastra/evals/scorers/utils";
import { z } from "zod";

import { GEMINI_FLASH } from "~/lib/llm-models";
import { testCases } from "~/mastra/data/eval-test-cases";

const extractKnowledgeSearchResults = (
  steps: Array<{ toolResults?: unknown[] }> | undefined,
) => {
  const chunks: Array<{ score: number; content: string; source: string }> = [];

  for (const step of steps ?? []) {
    for (const toolResult of step.toolResults ?? []) {
      const tr = toolResult as {
        toolName: string;
        result?: {
          results?: Array<{ score: number; content: string; source: string }>;
        };
      };
      if (tr.toolName === "knowledge-search" && tr.result?.results) {
        chunks.push(
          ...tr.result.results.map((r) => ({
            score: r.score,
            content: r.content.slice(0, 200),
            source: r.source,
          })),
        );
      }
    }
  }

  return chunks;
};

const runEvalScorers = async ({
  input,
  output,
  groundTruth,
  context,
}: {
  input: string;
  output: string;
  groundTruth: string;
  context: string[];
}) => {
  const testRun = createAgentTestRun({
    inputMessages: [createTestMessage({ content: input, role: "user" })],
    output: [createTestMessage({ content: output, role: "assistant" })],
  });

  const [
    similarity,
    faithfulness,
    contextPrecision,
    contextRelevance,
    hallucination,
  ] = await Promise.all([
    createAnswerSimilarityScorer({ model: GEMINI_FLASH }).run({
      input: testRun.input,
      output: testRun.output,
      groundTruth,
    }),
    createFaithfulnessScorer({ model: GEMINI_FLASH, options: { context } }).run(
      {
        input: testRun.input,
        output: testRun.output,
      },
    ),
    createContextPrecisionScorer({
      model: GEMINI_FLASH,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
      groundTruth,
    }),
    createContextRelevanceScorerLLM({
      model: GEMINI_FLASH,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
    }),
    createHallucinationScorer({
      model: GEMINI_FLASH,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
    }),
  ]);

  return {
    similarity,
    faithfulness,
    contextPrecision,
    contextRelevance,
    hallucination,
  };
};

const runEval = async (
  agent: {
    generate: (
      input: string,
    ) => Promise<{ text: string; steps: Array<{ toolResults?: unknown[] }> }>;
  },
  testCase: { input: string; groundTruth: string },
) => {
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
};

// 単一テストケース評価
const testCaseSchema = z.object({
  input: z.string(),
  groundTruth: z.string(),
});

const runSingleEval = createStep({
  id: "run-single-eval",
  description: "Run evaluation for a single test case",
  inputSchema: testCaseSchema,
  outputSchema: z.any(),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error("Input data not found");
    }

    const agent = mastra?.getAgent("nepChanAgent");
    if (!agent) {
      throw new Error("nepChanAgent not found");
    }

    return runEval(agent, inputData);
  },
});

const evalWorkflow = createWorkflow({
  id: "eval-workflow",
  inputSchema: testCaseSchema,
  outputSchema: z.any(),
}).then(runSingleEval);

evalWorkflow.commit();

// バッチ評価
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
      testCases.map((testCase) => runEval(agent, testCase)),
    );

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

export { evalBatchWorkflow, evalWorkflow };

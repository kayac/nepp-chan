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
import type { RequestContext } from "@mastra/core/request-context";
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

import { GEMINI_FLASH_LITE } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { testCases } from "~/mastra/data/eval-test-cases";

const KNOWLEDGE_TOOL_NAME = "knowledgeSearchTool";

const extractKnowledgeSearchResults = (
  steps: Array<{ toolResults?: unknown[] }> | undefined,
): Array<{ score: number; content: string; source: string }> => {
  // biome-ignore lint/suspicious/noExplicitAny: ツール結果の型は不定
  const toolResult = steps?.[0]?.toolResults?.[0] as any;
  const tr = toolResult?.payload ?? toolResult;

  if (tr?.toolName !== KNOWLEDGE_TOOL_NAME || !tr?.result?.results) {
    return [];
  }

  // biome-ignore lint/suspicious/noExplicitAny: ツール結果の型は不定
  return tr.result.results.map((r: any) => ({
    score: r.score,
    content: r.content,
    source: r.source,
  }));
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

  // context が空の場合、similarity のみ実行
  if (context.length === 0) {
    const similarity = await createAnswerSimilarityScorer({
      model: GEMINI_FLASH_LITE,
    }).run({
      input: testRun.input,
      output: testRun.output,
      groundTruth,
    });

    return { similarity };
  }

  // スコアラーを直列実行
  const similarity = await createAnswerSimilarityScorer({
    model: GEMINI_FLASH_LITE,
  }).run({
    input: testRun.input,
    output: testRun.output,
    groundTruth,
  });

  const faithfulness = await createFaithfulnessScorer({
    model: GEMINI_FLASH_LITE,
    options: { context },
  }).run({
    input: testRun.input,
    output: testRun.output,
  });

  const contextPrecision = await createContextPrecisionScorer({
    model: GEMINI_FLASH_LITE,
    options: { context },
  }).run({
    input: testRun.input,
    output: testRun.output,
    groundTruth,
  });

  const contextRelevance = await createContextRelevanceScorerLLM({
    model: GEMINI_FLASH_LITE,
    options: { context },
  }).run({
    input: testRun.input,
    output: testRun.output,
  });

  const hallucination = await createHallucinationScorer({
    model: GEMINI_FLASH_LITE,
    options: { context },
  }).run({
    input: testRun.input,
    output: testRun.output,
  });

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
      options?: { requestContext: RequestContext },
    ) => Promise<{ text: string; steps: Array<{ toolResults?: unknown[] }> }>;
  },
  testCase: { input: string; groundTruth: string },
  requestContext: RequestContext,
) => {
  const result = await agent.generate(testCase.input, { requestContext });
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
  execute: async ({ inputData, mastra, requestContext }) => {
    if (!inputData) {
      throw new Error("Input data not found");
    }

    const agent = mastra?.getAgent("knowledgeAgent");
    if (!agent) {
      throw new Error("knowledgeAgent not found");
    }

    return runEval(agent, inputData, requestContext);
  },
});

const evalWorkflow = createWorkflow({
  id: "eval-workflow",
  inputSchema: testCaseSchema,
  outputSchema: z.any(),
}).then(runSingleEval);

evalWorkflow.commit();

// バッチ評価
const runBatchEval = createStep({
  id: "run-batch-eval",
  description: "Run evaluation for all predefined test cases",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ mastra, requestContext }) => {
    const agent = mastra?.getAgent("knowledgeAgent");
    if (!agent) {
      throw new Error("knowledgeAgent not found");
    }

    const results = [];
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      logger.info("[EVAL] Starting test case", {
        index: i + 1,
        total: testCases.length,
        input: testCase.input.slice(0, 30),
      });

      const result = await runEval(agent, testCase, requestContext);

      logger.info("[EVAL] Completed test case", {
        index: i + 1,
        total: testCases.length,
        input: testCase.input.slice(0, 30),
      });
      results.push(result);
    }

    return results;
  },
});

const evalBatchWorkflow = createWorkflow({
  id: "eval-batch-workflow",
  inputSchema: z.object({}),
  outputSchema: z.any(),
}).then(runBatchEval);

evalBatchWorkflow.commit();

export { evalBatchWorkflow, evalWorkflow };

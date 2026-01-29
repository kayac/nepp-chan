/**
 * RAG評価ヘルパー
 *
 * 5つの観点でRAGシステムの品質を評価:
 * - similarity: 回答が期待回答とどれだけ一致しているか
 * - faithfulness: 回答が取得コンテキストに忠実か
 * - contextPrecision: 関連コンテキストが検索上位にあるか
 * - contextRelevance: 取得コンテキストが質問に対して有用か
 * - hallucination: コンテキストにない情報を捏造していないか
 */
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

const JUDGE_MODEL = "google/gemini-3-flash-preview";

/**
 * エージェントの生成結果からナレッジ検索ツールの結果を抽出
 */
export const extractKnowledgeSearchResults = (
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

/**
 * 5つの評価スコアラーを並列実行してRAG品質を評価
 */
export const runEvalScorers = async ({
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
    createAnswerSimilarityScorer({ model: JUDGE_MODEL }).run({
      input: testRun.input,
      output: testRun.output,
      groundTruth,
    }),
    createFaithfulnessScorer({ model: JUDGE_MODEL, options: { context } }).run({
      input: testRun.input,
      output: testRun.output,
    }),
    createContextPrecisionScorer({
      model: JUDGE_MODEL,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
      groundTruth,
    }),
    createContextRelevanceScorerLLM({
      model: JUDGE_MODEL,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
    }),
    createHallucinationScorer({ model: JUDGE_MODEL, options: { context } }).run(
      {
        input: testRun.input,
        output: testRun.output,
      },
    ),
  ]);

  return {
    similarity,
    faithfulness,
    contextPrecision,
    contextRelevance,
    hallucination,
  };
};

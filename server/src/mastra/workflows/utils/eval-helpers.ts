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

const JUDGE_MODEL = "google/gemini-3-flash-preview";

const similarityMatchSchema = z.object({
  groundTruthUnit: z.string(),
  outputUnit: z.string().nullable(),
  matchType: z.enum(["exact", "semantic", "partial", "missing"]),
  explanation: z.string(),
});

const similarityContradictionSchema = z.object({
  groundTruthUnit: z.string(),
  outputUnit: z.string(),
  explanation: z.string(),
});

const faithfulnessVerdictSchema = z.object({
  verdict: z.string(),
  reason: z.string(),
});

const hallucinationVerdictSchema = z.object({
  statement: z.string(),
  verdict: z.enum(["yes", "no"]),
  reason: z.string(),
});

const contextRelevanceItemSchema = z.object({
  context: z.string(),
  relevance: z.enum(["high", "medium", "low", "none"]),
  reason: z.string(),
});

export const evalScoresSchema = z.object({
  similarity: z.object({
    score: z.number(),
    reason: z.string(),
    details: z.object({
      outputUnits: z.array(z.string()),
      groundTruthUnits: z.array(z.string()),
      matches: z.array(similarityMatchSchema),
      extraInOutput: z.array(z.string()),
      contradictions: z.array(similarityContradictionSchema),
    }),
  }),
  faithfulness: z.object({
    score: z.number(),
    reason: z.string(),
    details: z.object({
      claims: z.array(z.string()),
      verdicts: z.array(faithfulnessVerdictSchema),
    }),
  }),
  contextPrecision: z.object({
    score: z.number(),
    reason: z.string(),
  }),
  contextRelevance: z.object({
    score: z.number(),
    reason: z.string(),
    details: z.object({
      items: z.array(contextRelevanceItemSchema),
      unusedHighRelevance: z.array(z.string()),
    }),
  }),
  hallucination: z.object({
    score: z.number(),
    reason: z.string(),
    details: z.object({
      claims: z.array(z.string()),
      verdicts: z.array(hallucinationVerdictSchema),
    }),
  }),
});

export const retrievedChunkSchema = z.object({
  score: z.number(),
  content: z.string(),
  source: z.string(),
});

export const evalResultSchema = z.object({
  input: z.string(),
  groundTruth: z.string(),
  answer: z.string(),
  retrievedChunks: z.array(retrievedChunkSchema),
  scores: evalScoresSchema,
});

export type EvalScores = z.infer<typeof evalScoresSchema>;
export type RetrievedChunk = z.infer<typeof retrievedChunkSchema>;
export type EvalResult = z.infer<typeof evalResultSchema>;

interface RunEvalScorersParams {
  input: string;
  output: string;
  groundTruth: string;
  context: string[];
}

interface SimilarityResult {
  score?: number;
  reason?: string;
  results?: {
    preprocessStepResult?: {
      outputUnits?: string[];
      groundTruthUnits?: string[];
    };
    analyzeStepResult?: {
      matches?: Array<{
        groundTruthUnit: string;
        outputUnit: string | null;
        matchType: "exact" | "semantic" | "partial" | "missing";
        explanation: string;
      }>;
      extraInOutput?: string[];
      contradictions?: Array<{
        groundTruthUnit: string;
        outputUnit: string;
        explanation: string;
      }>;
    };
  };
}

interface FaithfulnessResult {
  score?: number;
  reason?: string;
  results?: {
    preprocessStepResult?: string[];
    analyzeStepResult?: {
      verdicts?: Array<{
        verdict: string;
        reason: string;
      }>;
    };
  };
}

interface ContextPrecisionResult {
  score?: number;
  reason?: string;
}

interface ContextRelevanceResult {
  score?: number;
  reason?: string;
  results?: {
    analyzeStepResult?: {
      items?: Array<{
        context: string;
        relevance: "high" | "medium" | "low" | "none";
        reason: string;
      }>;
      unusedHighRelevance?: string[];
    };
  };
}

interface HallucinationResult {
  score?: number;
  reason?: string;
  results?: {
    preprocessStepResult?: {
      claims?: string[];
    };
    analyzeStepResult?: {
      verdicts?: Array<{
        statement: string;
        verdict: "yes" | "no";
        reason: string;
      }>;
    };
  };
}

interface KnowledgeSearchToolResult {
  toolName: string;
  result?: {
    results?: Array<{ score: number; content: string; source: string }>;
  };
}

interface GenerateStep {
  toolResults?: unknown[];
}

/**
 * エージェントの生成結果からナレッジ検索ツールの結果を抽出
 */
export const extractKnowledgeSearchResults = (
  steps: GenerateStep[] | undefined,
): RetrievedChunk[] => {
  const chunks: RetrievedChunk[] = [];

  for (const step of steps ?? []) {
    for (const toolResult of step.toolResults ?? []) {
      const tr = toolResult as unknown as KnowledgeSearchToolResult;
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
 *
 * @param input - ユーザーの質問
 * @param output - エージェントの回答
 * @param groundTruth - 期待される正解
 * @param context - RAGで取得したコンテキスト（チャンク）の配列
 */
export const runEvalScorers = async ({
  input,
  output,
  groundTruth,
  context,
}: RunEvalScorersParams): Promise<EvalScores> => {
  const testRun = createAgentTestRun({
    inputMessages: [createTestMessage({ content: input, role: "user" })],
    output: [createTestMessage({ content: output, role: "assistant" })],
  });

  // 回答が期待回答（groundTruth）とどれだけ一致しているか評価
  // exact/semantic/partial/missing の4段階でマッチング分析
  const runSimilarity = () =>
    createAnswerSimilarityScorer({ model: JUDGE_MODEL }).run({
      input: testRun.input,
      output: testRun.output,
      groundTruth,
    }) as Promise<SimilarityResult>;

  // 回答が取得コンテキストの情報のみに基づいているか評価
  // 回答内の各主張がコンテキストで裏付けられているかチェック
  const runFaithfulness = () =>
    createFaithfulnessScorer({
      model: JUDGE_MODEL,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
    }) as Promise<FaithfulnessResult>;

  // 関連コンテキストが検索結果の上位にあるか評価（MAP: Mean Average Precision）
  // 検索システムのランキング品質を測定
  const runContextPrecision = () =>
    createContextPrecisionScorer({
      model: JUDGE_MODEL,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
      groundTruth,
    }) as Promise<ContextPrecisionResult>;

  // 取得コンテキストが質問に対して有用か評価
  // high/medium/low/none の4段階で各コンテキストの関連性を分析
  const runContextRelevance = () =>
    createContextRelevanceScorerLLM({
      model: JUDGE_MODEL,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
    }) as Promise<ContextRelevanceResult>;

  // 回答がコンテキストにない情報を含んでいないか評価
  // 捏造された情報（幻覚）を検出
  const runHallucination = () =>
    createHallucinationScorer({
      model: JUDGE_MODEL,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
    }) as Promise<HallucinationResult>;

  const [
    similarityResult,
    faithfulnessResult,
    contextPrecisionResult,
    contextRelevanceResult,
    hallucinationResult,
  ] = await Promise.all([
    runSimilarity(),
    runFaithfulness(),
    runContextPrecision(),
    runContextRelevance(),
    runHallucination(),
  ]);

  return {
    similarity: {
      score: similarityResult.score ?? 0,
      reason: similarityResult.reason ?? "",
      details: {
        outputUnits:
          similarityResult.results?.preprocessStepResult?.outputUnits ?? [],
        groundTruthUnits:
          similarityResult.results?.preprocessStepResult?.groundTruthUnits ??
          [],
        matches: similarityResult.results?.analyzeStepResult?.matches ?? [],
        extraInOutput:
          similarityResult.results?.analyzeStepResult?.extraInOutput ?? [],
        contradictions:
          similarityResult.results?.analyzeStepResult?.contradictions ?? [],
      },
    },
    faithfulness: {
      score: faithfulnessResult.score ?? 0,
      reason: faithfulnessResult.reason ?? "",
      details: {
        claims: faithfulnessResult.results?.preprocessStepResult ?? [],
        verdicts: faithfulnessResult.results?.analyzeStepResult?.verdicts ?? [],
      },
    },
    contextPrecision: {
      score: contextPrecisionResult.score ?? 0,
      reason: contextPrecisionResult.reason ?? "",
    },
    contextRelevance: {
      score: contextRelevanceResult.score ?? 0,
      reason: contextRelevanceResult.reason ?? "",
      details: {
        items: contextRelevanceResult.results?.analyzeStepResult?.items ?? [],
        unusedHighRelevance:
          contextRelevanceResult.results?.analyzeStepResult
            ?.unusedHighRelevance ?? [],
      },
    },
    hallucination: {
      score: hallucinationResult.score ?? 0,
      reason: hallucinationResult.reason ?? "",
      details: {
        claims: hallucinationResult.results?.preprocessStepResult?.claims ?? [],
        verdicts:
          hallucinationResult.results?.analyzeStepResult?.verdicts ?? [],
      },
    },
  };
};

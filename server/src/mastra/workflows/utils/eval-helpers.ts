import {
  createAnswerSimilarityScorer,
  createFaithfulnessScorer,
} from "@mastra/evals/scorers/prebuilt";
import {
  createAgentTestRun,
  createTestMessage,
} from "@mastra/evals/scorers/utils";
import { z } from "zod";

export const JUDGE_MODEL = "google/gemini-3-flash-preview";

export const retrievedChunkSchema = z.object({
  score: z.number(),
  content: z.string(),
  source: z.string(),
});

export const evalScoresSchema = z.object({
  similarity: z.object({
    score: z.number(),
    reason: z.string(),
  }),
  faithfulness: z.object({
    score: z.number(),
    reason: z.string(),
  }),
});

export const evalResultSchema = z.object({
  input: z.string(),
  groundTruth: z.string(),
  answer: z.string(),
  retrievedChunks: z.array(retrievedChunkSchema),
  scores: evalScoresSchema,
});

export type RetrievedChunk = z.infer<typeof retrievedChunkSchema>;
export type EvalScores = z.infer<typeof evalScoresSchema>;
export type EvalResult = z.infer<typeof evalResultSchema>;

interface KnowledgeSearchToolResult {
  toolName: string;
  result?: {
    results?: Array<{ score: number; content: string; source: string }>;
  };
}

interface GenerateStep {
  toolResults?: unknown[];
}

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

interface RunEvalScorersParams {
  input: string;
  output: string;
  groundTruth: string;
  context: string[];
}

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

  const similarityScorer = createAnswerSimilarityScorer({
    model: JUDGE_MODEL,
  });

  const similarityResult = (await similarityScorer.run({
    input: testRun.input,
    output: testRun.output,
    groundTruth,
  })) as { score?: number; reason?: string };

  const faithfulnessScorer = createFaithfulnessScorer({
    model: JUDGE_MODEL,
    options: { context },
  });

  const faithfulnessResult = (await faithfulnessScorer.run({
    input: testRun.input,
    output: testRun.output,
  })) as { score?: number; reason?: string };

  return {
    similarity: {
      score: similarityResult.score ?? 0,
      reason: similarityResult.reason ?? "",
    },
    faithfulness: {
      score: faithfulnessResult.score ?? 0,
      reason: faithfulnessResult.reason ?? "",
    },
  };
};

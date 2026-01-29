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
  })) as SimilarityResult;

  const faithfulnessScorer = createFaithfulnessScorer({
    model: JUDGE_MODEL,
    options: { context },
  });

  const faithfulnessResult = (await faithfulnessScorer.run({
    input: testRun.input,
    output: testRun.output,
  })) as FaithfulnessResult;

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
  };
};

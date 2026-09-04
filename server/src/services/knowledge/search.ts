import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
import { createSimilarityPrompt } from "@mastra/core/relevance";
import type { RequestContext } from "@mastra/core/request-context";
import { rerankWithScorer } from "@mastra/rag";
import { embed } from "ai";
import {
  GEMINI_EMBEDDING,
  modelWithReasoning,
  OPENAI_LITE,
} from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import {
  recordUsageFromContext,
  withUsageRecording,
} from "~/services/analytics/llm-usage";
import { EMBEDDING_DIMENSIONS } from "./vector-store";

const SEARCH_TOP_K = 10;

const RERANK_TOP_K = 5;

// MastraAgentRelevanceScorer 相当の自前実装。usage 記録のために requestContext を
// generate まで通す必要があり、本家の getRelevanceScore(query, text) では渡せない。
// instructions は本家と同一（スコアリング挙動を変えないため）。
// 呼び出しごとの new は Agent ごとに ephemeral Mastra を増殖させるためモジュールスコープで保持する
const knowledgeRerankAgent = new Agent({
  id: "relevance-scorer-knowledge-reranker",
  name: "Relevance Scorer knowledge-reranker",
  instructions: `You are a specialized agent for evaluating the relevance of text to queries.
Your task is to rate how well a text passage answers a given query.
Output only a number between 0 and 1, where:
1.0 = Perfectly relevant, directly answers the query
0.0 = Completely irrelevant
Consider:
- Direct relevance to the question
- Completeness of information
- Quality and specificity
Always return just the number, no explanation.`,
  ...withUsageRecording(
    modelWithReasoning({ model: OPENAI_LITE, effort: "none" }),
    { agent: "knowledge-reranker", source: "rerank" },
  ),
});

const createRerankScorer = (requestContext?: RequestContext) => ({
  getRelevanceScore: async (query: string, text: string) => {
    const response = await knowledgeRerankAgent.generate(
      createSimilarityPrompt(query, text),
      { requestContext },
    );
    return Number.parseFloat(response.text);
  },
});

export type KnowledgeResult = {
  content: string;
  score: number;
  source: string;
  title?: string;
  section?: string;
  subsection?: string;
  url?: string;
  date?: string;
  dateType?: string;
};

export type SearchOutput = {
  results: KnowledgeResult[];
  error?: string;
};

const toKnowledgeResult = (
  metadata: Record<string, unknown> | undefined,
  score: number,
): KnowledgeResult => ({
  content: (metadata?.content as string | undefined) ?? "",
  score,
  source: (metadata?.source as string | undefined) ?? "unknown",
  title: metadata?.title as string | undefined,
  section: metadata?.section as string | undefined,
  subsection: metadata?.subsection as string | undefined,
  url: metadata?.url as string | undefined,
  date: metadata?.date as string | undefined,
  dateType: metadata?.date_type as string | undefined,
});

export const searchKnowledge = async (
  query: string,
  vectorize: VectorizeIndex,
  apiKey: string,
  requestContext?: RequestContext,
): Promise<SearchOutput> => {
  try {
    logger.info("[Knowledge] search", { query });
    const google = createGoogleGenerativeAI({ apiKey });
    const embeddingModel = google.textEmbeddingModel(GEMINI_EMBEDDING);

    const { embedding, usage } = await embed({
      model: embeddingModel,
      value: query,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
          taskType: "RETRIEVAL_QUERY",
        },
      },
    });
    await recordUsageFromContext(requestContext, {
      model: GEMINI_EMBEDDING,
      usage: { inputTokens: usage?.tokens ?? 0 },
      source: "embedding",
      agent: "embedding",
    });

    const results = await vectorize.query(embedding, {
      topK: SEARCH_TOP_K,
      returnMetadata: "all",
    });

    if (!results.matches || results.matches.length === 0) {
      return {
        results: [],
      };
    }

    const queryResults = results.matches.map((match) => {
      const result = toKnowledgeResult(
        match.metadata as Record<string, unknown> | undefined,
        match.score,
      );
      return {
        id: match.id,
        score: match.score,
        metadata: { ...result, text: result.content },
      };
    });

    const rerankedResults = await rerankWithScorer({
      results: queryResults,
      query,
      scorer: createRerankScorer(requestContext),
      options: {
        topK: RERANK_TOP_K,
        weights: {
          semantic: 0.5,
          vector: 0.3,
          position: 0.2,
        },
      },
    });

    const knowledgeResults = rerankedResults.map((r) => {
      const { text: _, ...result } = r.result.metadata as KnowledgeResult & {
        text: string;
      };
      return { ...result, score: r.score };
    });

    logger.info("[Knowledge] search result", {
      query,
      hits: knowledgeResults
        .map(
          (r) =>
            `${r.source}${r.section ? `#${r.section}` : ""}(${r.score.toFixed(2)})`,
        )
        .join(", "),
    });

    return {
      results: knowledgeResults,
    };
  } catch (error) {
    logger.error("Knowledge search error", error);
    return {
      results: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

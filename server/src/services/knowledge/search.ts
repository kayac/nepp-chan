import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { RequestContext } from "@mastra/core/request-context";
import { embed } from "ai";
import { GEMINI_EMBEDDING } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import {
  recordUsageFromContext,
  runInBackground,
} from "~/services/analytics/llm-usage";
import { boostByRecency } from "./recency";
import { scoreRelevance } from "./rerank-scorer";
import { EMBEDDING_DIMENSIONS } from "./vector-store";

const SEARCH_TOP_K = 50;

const RERANK_CANDIDATES = 15;

const RERANK_TOP_K = 5;

const RECENCY_WEIGHT = 0.15;

const RELEVANCE_WEIGHT = 0.5;

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
    runInBackground(
      recordUsageFromContext(requestContext, {
        model: GEMINI_EMBEDDING,
        usage: { inputTokens: usage?.tokens ?? 0 },
        source: "embedding",
        agent: "embedding",
      }),
    );

    const results = await vectorize.query(embedding, {
      topK: SEARCH_TOP_K,
      returnMetadata: "all",
    });

    if (!results.matches || results.matches.length === 0) {
      return {
        results: [],
      };
    }

    const now = new Date();
    const candidates = boostByRecency(
      results.matches.map((match) => {
        const result = toKnowledgeResult(
          match.metadata as Record<string, unknown> | undefined,
          match.score,
        );
        return {
          id: match.id,
          score: match.score,
          result,
          date: result.date,
          dateType: result.dateType,
        };
      }),
      now,
      RECENCY_WEIGHT,
    ).slice(0, RERANK_CANDIDATES);

    const relevance = await scoreRelevance(
      query,
      candidates.map((c) => c.result.content),
      requestContext,
    );

    const knowledgeResults = boostByRecency(
      candidates.map((c, i) => ({
        ...c.result,
        score:
          RELEVANCE_WEIGHT * relevance[i] +
          (1 - RELEVANCE_WEIGHT) * c.result.score,
      })),
      now,
      RECENCY_WEIGHT,
    ).slice(0, RERANK_TOP_K);

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

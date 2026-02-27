import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ModelRouterLanguageModel } from "@mastra/core/llm";
import { MastraAgentRelevanceScorer, rerankWithScorer } from "@mastra/rag";
import { embed } from "ai";
import { GEMINI_EMBEDDING, GEMINI_FLASH } from "~/lib/llm-models";

const EMBEDDING_DIMENSIONS = 1536;

const SEARCH_TOP_K = 10;

const RERANK_TOP_K = 3;

export interface KnowledgeResult {
  content: string;
  score: number;
  source: string;
  title?: string;
  section?: string;
  subsection?: string;
}

export interface SearchOutput {
  results: KnowledgeResult[];
  error?: string;
}

export const searchKnowledge = async (
  query: string,
  vectorize: VectorizeIndex,
  apiKey: string,
): Promise<SearchOutput> => {
  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const embeddingModel = google.textEmbeddingModel(GEMINI_EMBEDDING);

    const { embedding } = await embed({
      model: embeddingModel,
      value: query,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
          taskType: "RETRIEVAL_QUERY",
        },
      },
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
      const metadata = match.metadata as Record<string, unknown> | undefined;
      return {
        id: match.id,
        score: match.score,
        metadata: {
          text: (metadata?.content as string) || "",
          content: (metadata?.content as string) || "",
          source: (metadata?.source as string) || "unknown",
          title: metadata?.title as string | undefined,
          section: metadata?.section as string | undefined,
          subsection: metadata?.subsection as string | undefined,
        },
      };
    });

    const rerankModel = new ModelRouterLanguageModel(GEMINI_FLASH);
    const scorer = new MastraAgentRelevanceScorer(
      "knowledge-reranker",
      rerankModel,
    );
    const rerankedResults = await rerankWithScorer({
      results: queryResults,
      query,
      scorer,
      options: {
        topK: RERANK_TOP_K,
        weights: {
          semantic: 0.5,
          vector: 0.3,
          position: 0.2,
        },
      },
    });

    const knowledgeResults: KnowledgeResult[] = rerankedResults.map((r) => ({
      content: (r.result.metadata?.content as string) || "",
      score: r.score,
      source: (r.result.metadata?.source as string) || "unknown",
      title: r.result.metadata?.title as string | undefined,
      section: r.result.metadata?.section as string | undefined,
      subsection: r.result.metadata?.subsection as string | undefined,
    }));

    return {
      results: knowledgeResults,
    };
  } catch (error) {
    console.error("Knowledge search error:", error);
    return {
      results: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

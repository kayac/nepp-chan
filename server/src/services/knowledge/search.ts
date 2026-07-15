import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { RelevanceScoreProvider } from "@mastra/core/relevance";
import { createSimilarityPrompt } from "@mastra/core/relevance";
import { rerankWithScorer } from "@mastra/rag";
import { embed } from "ai";
import { GEMINI_EMBEDDING } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { getCoreMastra } from "~/mastra/core-mastra";

const EMBEDDING_DIMENSIONS = 1536;

const SEARCH_TOP_K = 10;

const RERANK_TOP_K = 5;

// FIXME: mastra-ai/mastra#19462 の回避。MastraAgentRelevanceScorer は内部で未登録 Agent を
// 生成し workerd でクラッシュするため公開インターフェースを自前実装している。
// upstream 修正後は MastraAgentRelevanceScorer（シングルトン化）に戻す。
export const knowledgeRerankScorer: RelevanceScoreProvider = {
  getRelevanceScore: async (query, text) => {
    const agent = getCoreMastra().getAgent("knowledgeRerankerAgent");
    const result = await agent.generate(createSimilarityPrompt(query, text));
    return Number.parseFloat(result.text);
  },
};

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
          url: metadata?.url as string | undefined,
          date: metadata?.date as string | undefined,
          dateType: metadata?.date_type as string | undefined,
        },
      };
    });

    const rerankedResults = await rerankWithScorer({
      results: queryResults,
      query,
      scorer: knowledgeRerankScorer,
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
      url: r.result.metadata?.url as string | undefined,
      date: r.result.metadata?.date as string | undefined,
      dateType: r.result.metadata?.dateType as string | undefined,
    }));

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

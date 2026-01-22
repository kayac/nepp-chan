import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ModelRouterLanguageModel } from "@mastra/core/llm";
import { createTool } from "@mastra/core/tools";
import { rerank } from "@mastra/rag";
import { embed } from "ai";
import { z } from "zod";

const EMBEDDING_MODEL_NAME = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 1536;
const RERANK_MODEL_ID = "google/gemini-flash-latest" as const;

const SEARCH_TOP_K = 10;

const RERANK_TOP_K = 3;

type KnowledgeBindings = CloudflareBindings & {
  VECTORIZE: VectorizeIndex;
};

interface KnowledgeResult {
  content: string;
  score: number;
  source: string;
  title?: string;
  section?: string;
  subsection?: string;
}

interface SearchOutput {
  results: KnowledgeResult[];
  error?: string;
}

export const knowledgeSearchTool = createTool({
  id: "knowledge-search",
  description:
    "音威子府村のナレッジベースから関連情報を検索します。村の歴史、施設、観光、村長の政策など村に関する情報を調べるときに使用してください。",
  inputSchema: z.object({
    query: z
      .string()
      .describe("検索したい内容（例: 村長の政策、観光スポット、村の歴史）"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        content: z.string(),
        score: z.number(),
        source: z.string(),
        title: z.string().optional(),
        section: z.string().optional(),
        subsection: z.string().optional(),
      }),
    ),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const env = context?.requestContext?.get("env") as
      | KnowledgeBindings
      | undefined;

    if (!env?.VECTORIZE) {
      return {
        results: [],
        error: "VECTORIZE_NOT_CONFIGURED",
      };
    }

    if (!env?.GOOGLE_GENERATIVE_AI_API_KEY) {
      return {
        results: [],
        error: "API_KEY_MISSING",
      };
    }

    return await searchKnowledge(
      inputData.query,
      env.VECTORIZE,
      env.GOOGLE_GENERATIVE_AI_API_KEY,
    );
  },
});

const searchKnowledge = async (
  query: string,
  vectorize: VectorizeIndex,
  apiKey: string,
): Promise<SearchOutput> => {
  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const embeddingModel = google.textEmbeddingModel(EMBEDDING_MODEL_NAME);

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

    // デバッグ: embedding の先頭5要素を出力
    console.log(
      `[RAG Debug] query="${query}", embedding[0:5]=[${embedding
        .slice(0, 5)
        .map((v) => v.toFixed(4))
        .join(", ")}]`,
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

    const rerankModel = new ModelRouterLanguageModel(RERANK_MODEL_ID);
    const rerankedResults = await rerank(queryResults, query, rerankModel, {
      topK: RERANK_TOP_K,
      weights: {
        semantic: 0.5,
        vector: 0.3,
        position: 0.2,
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

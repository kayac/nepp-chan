import { createTool } from "@mastra/core/tools";
import { embed } from "ai";
import { z } from "zod";

const EMBEDDING_MODEL = "google:text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;

type KnowledgeBindings = CloudflareBindings & {
  VECTORIZE: VectorizeIndex;
};

interface KnowledgeResult {
  content: string;
  score: number;
  source: string;
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
    topK: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe("取得する結果の件数（1-20、デフォルト: 5）"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        content: z.string(),
        score: z.number(),
        source: z.string(),
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
      inputData.topK ?? 5,
      env.VECTORIZE,
    );
  },
});

const searchKnowledge = async (
  query: string,
  topK: number,
  vectorize: VectorizeIndex,
): Promise<SearchOutput> => {
  try {
    // クエリをエンベディング
    const { embedding } = await embed({
      model: EMBEDDING_MODEL,
      value: query,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
        },
      },
    });

    // Vectorizeで類似検索
    const results = await vectorize.query(embedding, {
      topK,
      returnMetadata: "all",
    });

    if (!results.matches || results.matches.length === 0) {
      return {
        results: [],
      };
    }

    // 結果をマッピング
    const knowledgeResults: KnowledgeResult[] = results.matches.map((match) => {
      const metadata = match.metadata as Record<string, unknown> | undefined;
      return {
        content: (metadata?.content as string) || "",
        score: match.score,
        source: (metadata?.source as string) || "unknown",
        section: metadata?.section as string | undefined,
        subsection: metadata?.subsection as string | undefined,
      };
    });

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

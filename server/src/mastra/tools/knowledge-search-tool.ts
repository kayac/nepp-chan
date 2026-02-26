import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchKnowledge } from "~/services/knowledge/search";
import { getEnv } from "./helpers";

type KnowledgeBindings = CloudflareBindings & {
  VECTORIZE: VectorizeIndex;
};

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
    const env = getEnv(context) as KnowledgeBindings | undefined;

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

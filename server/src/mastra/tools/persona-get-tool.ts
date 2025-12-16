import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { personaRepository } from "~/repository/persona-repository";

const personaSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  content: z.string(),
  source: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const personaGetTool = createTool({
  id: "persona-get",
  description:
    "村の集合知（ペルソナ）を検索・取得します。ユーザーの質問に答える際に、村の傾向や価値観を参照するときに使用します。自然言語のキーワードやカテゴリ、タグで検索できます。",
  inputSchema: z.object({
    resourceId: z.string().describe("リソースID（村やグループの識別子）"),
    category: z
      .string()
      .optional()
      .describe("カテゴリで絞り込み（例: 好み、価値観、決定事項）"),
    tags: z
      .array(z.string())
      .optional()
      .describe('タグで絞り込み（例: ["男性", "高齢者"]）'),
    keyword: z
      .string()
      .optional()
      .describe("キーワードで内容を検索（自然言語OK）"),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .default(20)
      .describe("取得する最大件数。デフォルトは20件"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    personas: z.array(personaSchema),
    count: z.number(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const db = context?.requestContext?.get("db") as D1Database | undefined;

    if (!db) {
      return {
        success: false,
        personas: [],
        count: 0,
        message: "データベース接続がありません",
        error: "DB_NOT_AVAILABLE",
      };
    }

    const { resourceId, category, tags, keyword, limit } = inputData;

    try {
      const personas = await personaRepository.search(db, resourceId, {
        category,
        tags,
        keyword,
        limit,
      });

      if (personas.length === 0) {
        return {
          success: true,
          personas: [],
          count: 0,
          message: "該当するペルソナ情報が見つかりませんでした",
        };
      }

      return {
        success: true,
        personas,
        count: personas.length,
        message: `${personas.length}件のペルソナ情報を取得しました`,
      };
    } catch (error) {
      console.error("Persona fetch failed:", error);
      return {
        success: false,
        personas: [],
        count: 0,
        message: "ペルソナ情報の取得に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

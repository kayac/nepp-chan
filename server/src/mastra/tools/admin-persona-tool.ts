import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type { AdminUser } from "~/db";
import { personaRepository } from "~/repository/persona-repository";

const personaSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  content: z.string(),
  source: z.string().nullable(),
  topic: z.string().nullable(),
  sentiment: z.string().nullable(),
  demographicSummary: z.string().nullable(),
  createdAt: z.string(),
  conversationEndedAt: z.string().nullable(),
});

export const adminPersonaTool = createTool({
  id: "admin-persona",
  description:
    "【管理者専用】ペルソナ（住民の声）データを取得・分析します。管理者としてログインしている場合のみ使用可能です。",
  inputSchema: z.object({
    category: z
      .string()
      .optional()
      .describe("カテゴリでフィルター（例: 要望、意見、感想など）"),
    sentiment: z
      .enum(["positive", "negative", "neutral", "request"])
      .optional()
      .describe("感情でフィルター"),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .default(30)
      .describe("取得する最大件数。デフォルトは30件、最大100件"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    personas: z.array(personaSchema),
    count: z.number(),
    message: z.string(),
    summary: z
      .object({
        totalCount: z.number(),
        categories: z.record(z.string(), z.number()),
        sentiments: z.record(z.string(), z.number()),
      })
      .optional(),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const adminUser = context?.requestContext?.get("adminUser") as
      | AdminUser
      | undefined;

    if (!adminUser) {
      return {
        success: false,
        personas: [],
        count: 0,
        message: "この機能は使用できません",
        error: "NOT_AUTHORIZED",
      };
    }

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

    const { category, sentiment, limit } = inputData;

    try {
      const result = await personaRepository.list(db, {
        category,
        sentiment,
        limit,
      });

      const personas = result.personas.map((p) => ({
        id: p.id,
        resourceId: p.resourceId,
        category: p.category,
        tags: p.tags,
        content: p.content,
        source: p.source,
        topic: p.topic,
        sentiment: p.sentiment,
        demographicSummary: p.demographicSummary,
        createdAt: p.createdAt,
        conversationEndedAt: p.conversationEndedAt,
      }));

      const stats = await personaRepository.getStats(db);

      const filterDesc = [];
      if (category) filterDesc.push(`カテゴリ: ${category}`);
      if (sentiment) filterDesc.push(`感情: ${sentiment}`);
      const filterLabel =
        filterDesc.length > 0 ? `（${filterDesc.join(", ")}）` : "";

      return {
        success: true,
        personas,
        count: personas.length,
        message: `【管理者】ペルソナデータ${filterLabel}を${personas.length}件取得しました`,
        summary: {
          totalCount: stats.total,
          categories: stats.byCategory,
          sentiments: stats.bySentiment,
        },
      };
    } catch (error) {
      console.error("Admin persona fetch failed:", error);
      return {
        success: false,
        personas: [],
        count: 0,
        message: "ペルソナデータの取得に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

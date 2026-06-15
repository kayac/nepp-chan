import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { personaRepository } from "~/repository/persona-repository";
import { personaEntitiesSchema } from "~/schemas/persona-entity-schema";
import { getConversationEndedAt, requireDb } from "./helpers";

export const personaSaveTool = createTool({
  id: "persona-save",
  description:
    "村の集合知（ペルソナ）を新規保存します。会話から得られた知見、ユーザーの好み、村の価値観、決定事項などを抽象化して蓄積するときに使用します。",
  inputSchema: z.object({
    category: z
      .string()
      .describe(
        "カテゴリ（意見/関心事/要望/困りごと/好み/体験談/提案/探し物/プロダクト）",
      ),
    tags: z
      .string()
      .optional()
      .describe("タグ（カンマ区切り、例: 男性,高齢者,農業）"),
    content: z
      .string()
      .describe(
        "抽象化された知見の内容（例: 「村民は地元産の野菜を好む傾向がある」）",
      ),
    source: z
      .string()
      .optional()
      .describe("情報源（例: 会話、アンケート結果）"),
    topic: z
      .string()
      .optional()
      .describe(
        "正規化されたトピック（例: 交通, 買い物, 医療, 除雪, 教育, その他）",
      ),
    sentiment: z
      .enum(["positive", "neutral", "negative", "request"])
      .optional()
      .describe("感情・意図（positive/neutral/negative/request）"),
    demographicSummary: z
      .string()
      .optional()
      .describe("属性サマリー（例: 60代,村内）"),
    entities: personaEntitiesSchema
      .optional()
      .describe(
        "言及された固有エンティティ（施設・サービス・制度等）。name に正規名、type に種別を入れる。個人名等は含めない",
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    personaId: z.string().optional(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const result = requireDb(context);
    if ("error" in result) {
      return {
        success: false,
        message: result.error.message,
        error: result.error.error,
      };
    }
    const { db } = result;
    const conversationEndedAt = getConversationEndedAt(context);

    const {
      category,
      tags,
      content,
      source,
      topic,
      sentiment,
      demographicSummary,
      entities,
    } = inputData;

    const personaId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    try {
      await personaRepository.create(db, {
        id: personaId,
        category,
        tags,
        content,
        source,
        topic,
        sentiment,
        demographicSummary,
        entities: entities ? JSON.stringify(entities) : undefined,
        createdAt,
        conversationEndedAt,
      });

      return {
        success: true,
        personaId,
        message: `ペルソナ情報を保存しました（ID: ${personaId}）`,
      };
    } catch (error) {
      logger.error("Persona save failed", error);
      return {
        success: false,
        message: "ペルソナ情報の保存に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

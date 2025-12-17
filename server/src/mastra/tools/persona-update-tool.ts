import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { personaRepository } from "~/db/persona-repository";

export const personaUpdateTool = createTool({
  id: "persona-update",
  description:
    "既存のペルソナ情報を更新・洗練します。新しい知見が得られた時や、既存の情報をより正確にするときに使用します。",
  inputSchema: z.object({
    id: z.string().describe("更新対象のペルソナID"),
    category: z.string().optional().describe("新しいカテゴリ"),
    tags: z.string().optional().describe("新しいタグ（カンマ区切り）"),
    content: z.string().optional().describe("更新後の知見の内容"),
    source: z.string().optional().describe("情報源"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const db = context?.requestContext?.get("db") as D1Database | undefined;

    if (!db) {
      return {
        success: false,
        message: "データベース接続がありません",
        error: "DB_NOT_AVAILABLE",
      };
    }

    const { id, category, tags, content, source } = inputData;

    try {
      const existing = await personaRepository.findById(db, id);
      if (!existing) {
        return {
          success: false,
          message: `ペルソナID: ${id} が見つかりません`,
          error: "NOT_FOUND",
        };
      }

      const result = await personaRepository.update(db, id, {
        category,
        tags,
        content,
        source,
      });

      if (!result.success) {
        return {
          success: false,
          message: result.error ?? "更新に失敗しました",
          error: "UPDATE_FAILED",
        };
      }

      return {
        success: true,
        message: `ペルソナ情報を更新しました（ID: ${id}）`,
      };
    } catch (error) {
      console.error("Persona update failed:", error);
      return {
        success: false,
        message: "ペルソナ情報の更新に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

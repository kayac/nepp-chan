import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { emergencyRepository } from "~/db/emergency-repository";

export const emergencyUpdateTool = createTool({
  id: "emergency-update",
  description:
    "既存の緊急報告に追加情報を更新します。報告IDを指定して、詳細情報や場所を追加・修正できます。",
  inputSchema: z.object({
    reportId: z.string().describe("更新する報告のID"),
    description: z.string().optional().describe("追加の詳細情報"),
    location: z.string().optional().describe("場所の追加・修正"),
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

    const { reportId, description, location } = inputData;

    if (!description && !location) {
      return {
        success: false,
        message: "更新する項目（詳細情報または場所）を指定してください",
        error: "NO_UPDATE_FIELDS",
      };
    }

    try {
      const existing = await emergencyRepository.findById(db, reportId);

      if (!existing) {
        return {
          success: false,
          message: `報告ID ${reportId} が見つかりません`,
          error: "REPORT_NOT_FOUND",
        };
      }

      const result = await emergencyRepository.update(db, reportId, {
        description,
        location,
      });

      if (result.success) {
        return {
          success: true,
          message: `報告 ${reportId} を更新しました`,
        };
      }

      return {
        success: false,
        message: "更新に失敗しました",
        error: result.error,
      };
    } catch (error) {
      console.error("Emergency report update failed:", error);
      return {
        success: false,
        message: "緊急報告の更新に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { emergencyRepository } from "~/repository/emergency-repository";

export const emergencyReportTool = createTool({
  id: "emergency-report",
  description:
    "住民の安全・生活に影響する緊急事態を記録する。野生動物、災害、火災、事故、不審者、インフラ障害、健康危機など幅広く対応。危険や不安を感じる情報を聞いたら、迷わずこのツールを使用する。",
  inputSchema: z.object({
    type: z
      .string()
      .describe(
        "緊急事態の種類（例: 野生動物目撃、自然災害、インフラ障害、健康危機、事故・事件）",
      ),
    description: z.string().optional().describe("詳細情報"),
    location: z.string().optional().describe("発生場所"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reportId: z.string().optional(),
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

    const { type, description, location } = inputData;

    const reportId = crypto.randomUUID();
    const reportedAt = new Date().toISOString();

    try {
      await emergencyRepository.create(db, {
        id: reportId,
        type,
        description,
        location,
        reportedAt,
      });

      return {
        success: true,
        reportId,
        message: `緊急報告を記録しました（ID: ${reportId}）`,
      };
    } catch (error) {
      console.error("Emergency report creation failed:", error);
      return {
        success: false,
        message: "緊急報告の記録に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

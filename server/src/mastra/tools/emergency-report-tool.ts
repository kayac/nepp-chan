import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { emergencyRepository } from "~/repository/emergency-repository";

export const emergencyReportTool = createTool({
  id: "emergency-report",
  description:
    "緊急事態（クマ出没、火事、不審者、事故など）を即座に報告・記録するためのツールです。ユーザーから危険な情報や緊急性の高い情報を聞いた場合は、他のツールではなく必ずこのツールを最優先で使用してください。",
  inputSchema: z.object({
    type: z
      .string()
      .describe("緊急事態の種類（例: クマ出没、火災、不審者目撃、交通事故）"),
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

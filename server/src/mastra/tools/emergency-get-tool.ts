import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type { AdminUser } from "~/db";
import { emergencyRepository } from "~/repository/emergency-repository";

const emergencyReportSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  reportedAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const emergencyGetTool = createTool({
  id: "emergency-get",
  description:
    "【管理者専用】緊急報告の一覧を取得します。直近の日数を指定して、その期間内の緊急事態情報を取得できます。",
  inputSchema: z.object({
    days: z
      .number()
      .int()
      .positive()
      .default(7)
      .describe("取得する期間（直近n日）。デフォルトは7日"),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .default(20)
      .describe("取得する最大件数。デフォルトは20件、最大100件"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reports: z.array(emergencyReportSchema),
    count: z.number(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const adminUser = context?.requestContext?.get("adminUser") as
      | AdminUser
      | undefined;

    if (!adminUser) {
      return {
        success: false,
        reports: [],
        count: 0,
        message: "この機能は使用できません",
        error: "NOT_AUTHORIZED",
      };
    }

    const db = context?.requestContext?.get("db") as D1Database | undefined;

    if (!db) {
      return {
        success: false,
        reports: [],
        count: 0,
        message: "データベース接続がありません",
        error: "DB_NOT_AVAILABLE",
      };
    }

    const { days, limit } = inputData;

    try {
      const reports = await emergencyRepository.findRecent(db, days, limit);

      if (reports.length === 0) {
        return {
          success: true,
          reports: [],
          count: 0,
          message: `直近${days}日間の緊急報告はありません`,
        };
      }

      return {
        success: true,
        reports,
        count: reports.length,
        message: `直近${days}日間の緊急報告を${reports.length}件取得しました`,
      };
    } catch (error) {
      console.error("Emergency reports fetch failed:", error);
      return {
        success: false,
        reports: [],
        count: 0,
        message: "緊急報告の取得に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

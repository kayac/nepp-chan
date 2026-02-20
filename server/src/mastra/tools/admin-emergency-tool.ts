import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { emergencyReportSchema } from "~/mastra/schemas/emergency-schema";
import { emergencyRepository } from "~/repository/emergency-repository";
import { requireAdmin } from "./helpers";

export const adminEmergencyTool = createTool({
  id: "admin-emergency",
  description:
    "【管理者専用】全ての緊急報告を取得します。管理者としてログインしている場合のみ使用可能です。",
  inputSchema: z.object({
    days: z
      .number()
      .int()
      .positive()
      .default(30)
      .describe("取得する期間（直近n日）。デフォルトは30日"),
    limit: z
      .number()
      .int()
      .positive()
      .max(200)
      .default(50)
      .describe("取得する最大件数。デフォルトは50件、最大200件"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reports: z.array(emergencyReportSchema),
    count: z.number(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const result = requireAdmin(context);
    if ("error" in result) {
      return {
        success: false,
        reports: [],
        count: 0,
        message: result.error.message,
        error: result.error.error,
      };
    }
    const { db } = result;

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
        message: `【管理者】直近${days}日間の緊急報告を${reports.length}件取得しました`,
      };
    } catch (error) {
      console.error("Admin emergency reports fetch failed:", error);
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

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { personaRepository } from "~/repository/persona-repository";
import { requireAdmin } from "./helpers";

export const personaAggregateTool = createTool({
  id: "persona-aggregate",
  description:
    "【管理者専用】村の集合知をトピック別に集計します。「バスの増便要望が5件（60代が多い）」のような形式で傾向を把握できます。",
  inputSchema: z.object({
    resourceId: z.string().describe("リソースID（村やグループの識別子）"),
    category: z
      .string()
      .optional()
      .describe("カテゴリで絞り込み（例: 要望、意見、困りごと）"),
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .default(20)
      .describe("取得する最大件数"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    aggregations: z.array(
      z.object({
        topic: z.string(),
        category: z.string(),
        count: z.number(),
        demographics: z.string(),
        samples: z.array(z.string()),
      }),
    ),
    totalCount: z.number(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const result = requireAdmin(context);
    if ("error" in result) {
      return {
        success: false,
        aggregations: [],
        totalCount: 0,
        message: result.error.message,
        error: result.error.error,
      };
    }
    const { db } = result;

    const { resourceId, category, limit } = inputData;

    try {
      const results = await personaRepository.aggregateByTopic(db, resourceId, {
        category,
        limit,
      });

      if (results.length === 0) {
        return {
          success: true,
          aggregations: [],
          totalCount: 0,
          message: "集計対象のデータがありません",
        };
      }

      const aggregations = results.map((row) => ({
        topic: row.topic,
        category: row.category,
        count: row.count,
        demographics: formatDemographics(row.demographics),
        samples: parseSamples(row.samples, 3),
      }));

      const totalCount = aggregations.reduce((sum, a) => sum + a.count, 0);

      return {
        success: true,
        aggregations,
        totalCount,
        message: `${aggregations.length}件のトピックを集計しました（合計${totalCount}件の意見）`,
      };
    } catch (error) {
      console.error("Persona aggregation failed:", error);
      return {
        success: false,
        aggregations: [],
        totalCount: 0,
        message: "集計に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const formatDemographics = (demographics: string | null): string => {
  if (!demographics) return "不明";

  const items = demographics.split(",").filter(Boolean);
  const counts: Record<string, number> = {};

  for (const item of items) {
    const trimmed = item.trim();
    if (trimmed) {
      counts[trimmed] = (counts[trimmed] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key}(${count})`)
    .join(", ");
};

const parseSamples = (samples: string | null, maxCount: number): string[] => {
  if (!samples) return [];

  return samples
    .split(" | ")
    .filter(Boolean)
    .slice(0, maxCount)
    .map((s) => s.trim());
};

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { personaRepository } from "~/repository/persona-repository";
import {
  aggregateAudiences,
  findAttributeGroup,
  loadTagGroups,
  summarizeGroup,
} from "~/services/analytics/tag-groups";
import { requireAdmin } from "./helpers";

const TOPIC_LIMIT = 5;

export const personaAudienceTool = createTool({
  id: "persona-audience",
  description:
    "【管理者専用】話者の層（観光客・村内住民・10代・そば好きなど）ごとに、声の件数・話題と感情・他の軸での内訳（例: そば好きのうち村内と村外の比率）・代表的な声を返します。層を指定しなければ全層の一覧を返します。",
  inputSchema: z.object({
    group: z
      .string()
      .optional()
      .describe(
        "層の名前（例: 観光客、村内住民、10代、そば好き）。省略すると全層の一覧",
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
    group: z
      .object({
        name: z.string(),
        axis: z.string().nullable(),
        count: z.number(),
        topics: z.array(
          z.object({
            topic: z.string(),
            positive: z.number(),
            negative: z.number(),
            request: z.number(),
            neutral: z.number(),
          }),
        ),
        entities: z.array(z.object({ name: z.string(), count: z.number() })),
        breakdown: z.array(
          z.object({
            axis: z.string(),
            groups: z.array(z.object({ name: z.string(), count: z.number() })),
          }),
        ),
        samples: z.array(
          z.object({
            content: z.string(),
            topic: z.string(),
            sentiment: z.string(),
          }),
        ),
      })
      .optional(),
    axes: z
      .array(
        z.object({
          axis: z.string(),
          groups: z.array(
            z.object({
              name: z.string(),
              count: z.number(),
              topTopics: z.array(z.string()),
            }),
          ),
        }),
      )
      .optional(),
  }),
  execute: async (inputData, context) => {
    const auth = requireAdmin(context, "staff");
    if ("error" in auth) {
      return {
        success: false,
        message: auth.error.message,
        error: auth.error.error,
      };
    }
    const { db } = auth;

    try {
      const [{ groups, aliases }, rows] = await Promise.all([
        loadTagGroups(db),
        personaRepository.listForAudience(db, {}),
      ]);

      if (!inputData.group) {
        const { axes } = aggregateAudiences(rows, groups, aliases);
        return {
          success: true,
          message: `${axes.length} 軸の層を集計しました`,
          axes: axes.map((a) => ({
            axis: a.axis,
            groups: a.groups.map((g) => ({
              name: g.name,
              count: g.count,
              topTopics: g.topics.slice(0, TOPIC_LIMIT).map((t) => t.topic),
            })),
          })),
        };
      }

      const target = findAttributeGroup(groups, inputData.group);
      if (!target) {
        const names = groups
          .filter((g) => g.kind === "attribute")
          .map((g) => g.name)
          .join("、");
        return {
          success: false,
          message: `「${inputData.group}」という層はありません。使える層: ${names}`,
        };
      }

      const summary = summarizeGroup(rows, groups, aliases, target.id);
      return {
        success: true,
        message: `${target.name} の声 ${summary.count} 件を集計しました`,
        group: { name: target.name, axis: target.axis, ...summary },
      };
    } catch (error) {
      logger.error("Persona audience failed", error);
      return {
        success: false,
        message: "層ごとの集計に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

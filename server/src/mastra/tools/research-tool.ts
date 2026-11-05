import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { research, researchInputSchema } from "~/services/research";

export const researchToolName = "researchTool";

export const researchTool = createTool({
  id: "research-answer",
  description:
    "村の資料と LINE 配信を観点ごとに検索し、web を付けた観点は Web 検索も足して、見つかった資料をそのまま返します。",
  inputSchema: researchInputSchema,
  outputSchema: z.object({
    materials: z.string(),
    failed: z.boolean(),
  }),
  execute: async (input, context) => {
    try {
      const materials = await research(input, {
        requestContext: context?.requestContext,
      });
      return { materials, failed: false };
    } catch (error) {
      logger.error("[Research] failed", error);
      return { materials: "", failed: true };
    }
  },
});

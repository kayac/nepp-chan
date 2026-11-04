import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { logger } from "~/lib/logger";
import {
  researchInputSchema,
  runResearch,
} from "~/mastra/workflows/research-workflow";

export const researchToolName = "researchTool";

export const researchTool = createTool({
  id: "research-answer",
  description:
    "村のナレッジと配信、必要に応じて Web を調べ、質問に答えるための調査メモを返します。どこを調べるかはツールが決めます。",
  inputSchema: researchInputSchema,
  outputSchema: z.object({
    memo: z.string(),
    failed: z.boolean(),
  }),
  execute: async (input, context) => {
    try {
      const { memo } = await runResearch({
        input,
        requestContext: context?.requestContext,
      });
      return { memo, failed: false };
    } catch (error) {
      logger.error("[Research] failed", error);
      return { memo: "", failed: true };
    }
  },
});

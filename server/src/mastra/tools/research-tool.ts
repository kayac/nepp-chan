import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { runResearch } from "~/mastra/workflows/research-workflow";

export const researchToolName = "researchTool";

const FAILED_MEMO =
  "調べ物が途中で失敗して、今回は調べられなかった。確認できなかったことを伝え、村の公式サイトや役場への確認を案内する。";

export const researchTool = createTool({
  id: "research-answer",
  description:
    "村のナレッジと配信、必要に応じて Web を調べ、質問に答えるための調査メモを返します。",
  inputSchema: z.object({
    question: z
      .string()
      .describe(
        "ユーザーの質問を短い1文で。指示語は会話の流れから補い、条件や調べ方の注文は足さない",
      ),
  }),
  outputSchema: z.object({ memo: z.string() }),
  execute: async ({ question }, context) => {
    try {
      return await runResearch({
        question,
        requestContext: context?.requestContext,
      });
    } catch (error) {
      logger.error("[Research] failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { memo: FAILED_MEMO };
    }
  },
});

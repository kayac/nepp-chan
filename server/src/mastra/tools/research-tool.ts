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
        "ユーザーの質問。ユーザーの言葉をなるべくそのまま使い、指示語だけ会話の流れから補う",
      ),
    queries: z
      .array(z.string())
      .max(5)
      .optional()
      .describe(
        "資料を探す検索語。質問に含まれる手続き・制度・施設ごとに 1 つずつ、多くても 5 つ。資料に出てきそうな制度名・施設名・手続き名で書く",
      ),
  }),
  outputSchema: z.object({ memo: z.string() }),
  execute: async ({ question, queries }, context) => {
    try {
      return await runResearch({
        question,
        queries,
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

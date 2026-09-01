import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { broadcastRepository } from "~/repository/broadcast-repository";
import { broadcastMessageSchema } from "~/schemas/broadcast-schema";
import { requireDb } from "./helpers";

/** エージェント登録キーと instructions 内の参照を一致させるための toolName */
export const broadcastGetToolName = "broadcastGetTool";

export const broadcastGetTool = createTool({
  id: "broadcast-get",
  description:
    "過去にLINEで配信したお知らせメッセージを取得します。IDで特定のメッセージを取得したり、キーワードで検索できます。",
  inputSchema: z.object({
    id: z
      .string()
      .optional()
      .describe("配信メッセージのID。特定のメッセージを取得する場合に指定"),
    keyword: z
      .string()
      .optional()
      .describe(
        "タイトルや本文を探す短い検索語。複数語は空白で区切り、質問全文ではなく重要な語だけを最大5語指定",
      ),
    limit: z
      .number()
      .int()
      .positive()
      .max(20)
      .default(10)
      .describe("取得する最大件数。デフォルトは10件"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    broadcasts: z.array(broadcastMessageSchema),
    count: z.number(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const result = requireDb(context);
    if ("error" in result) {
      return {
        success: false,
        broadcasts: [],
        count: 0,
        message: result.error.message,
        error: result.error.error,
      };
    }
    const { db } = result;

    const { id, keyword, limit } = inputData;

    try {
      if (id) {
        const broadcast = await broadcastRepository.findById(db, id);
        if (!broadcast) {
          return {
            success: true,
            broadcasts: [],
            count: 0,
            message: "指定されたIDの配信メッセージが見つかりません",
          };
        }
        return {
          success: true,
          broadcasts: [broadcast],
          count: 1,
          message: "配信メッセージを取得しました",
        };
      }

      if (keyword) {
        const broadcasts = await broadcastRepository.findByKeyword(
          db,
          keyword,
          limit,
        );
        return {
          success: true,
          broadcasts,
          count: broadcasts.length,
          message:
            broadcasts.length > 0
              ? `「${keyword}」で${broadcasts.length}件の配信メッセージが見つかりました`
              : `「${keyword}」に一致する配信メッセージはありません`,
        };
      }

      const listResult = await broadcastRepository.findAll(db, {
        limit,
        status: "sent",
      });
      return {
        success: true,
        broadcasts: listResult.broadcasts,
        count: listResult.broadcasts.length,
        message: `送信済みの配信メッセージを${listResult.broadcasts.length}件取得しました`,
      };
    } catch (error) {
      logger.error("Broadcast fetch failed", error);
      return {
        success: false,
        broadcasts: [],
        count: 0,
        message: "配信メッセージの取得に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

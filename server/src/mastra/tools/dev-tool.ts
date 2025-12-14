import type { D1Store } from "@mastra/cloudflare-d1";
import { createTool } from "@mastra/core/tools";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { personaSchema } from "~/mastra/schemas/persona-schema";

export const devTool = createTool({
  id: "dev-tool",
  description:
    "開発用コマンド。ユーザーのペルソナ情報を取得します。「/dev」コマンドで呼び出されます。",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    workingMemory: z.string().nullable(),
    message: z.string(),
  }),
  execute: async (_inputData, context) => {
    const storage = context?.requestContext?.get("storage") as
      | D1Store
      | undefined;

    if (!storage) {
      return {
        success: false,
        workingMemory: null,
        message: "ストレージ接続がありません",
      };
    }

    const memory = new Memory({
      storage,
      options: {
        workingMemory: {
          enabled: true,
          scope: "resource",
          schema: personaSchema,
        },
      },
    });

    const threadId = context?.agent?.threadId;
    const resourceId = context?.agent?.resourceId;

    if (!threadId || !resourceId) {
      return {
        success: false,
        workingMemory: null,
        message: "スレッドIDまたはリソースIDが見つかりません",
      };
    }

    const workingMemory = await memory.getWorkingMemory({
      threadId,
      resourceId,
    });

    if (!workingMemory) {
      return {
        success: true,
        workingMemory: null,
        message: "まだあなたのことを覚えていません",
      };
    }

    return {
      success: true,
      workingMemory,
      message: "Working Memory を取得しました",
    };
  },
});

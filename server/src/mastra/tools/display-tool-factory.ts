import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * display 系ツールを生成する。実描画は web 側（toolsByName）が担うため、
 * サーバー側は成功応答を返すだけで何もしない。
 */
export const createDisplayTool = <TSchema extends z.ZodType>(config: {
  id: string;
  description: string;
  inputSchema: TSchema;
}) =>
  createTool({
    ...config,
    outputSchema: z.object({
      displayed: z.boolean(),
    }),
    execute: async () => ({ displayed: true }),
  });

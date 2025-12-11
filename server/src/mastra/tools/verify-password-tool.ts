import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const verifyPasswordTool = createTool({
  id: "verify-password",
  description:
    "村長モードのパスワードを検証します。/master コマンドの後にパスワード検証が必要な場合に使用します。",
  inputSchema: z.object({
    password: z.string().describe("検証するパスワード"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    const masterPassword = context?.requestContext?.get("masterPassword") as
      | string
      | undefined;

    if (!masterPassword) {
      return {
        success: false,
        message: "村長モードは現在利用できません",
      };
    }

    const { password } = inputData;

    if (password === masterPassword) {
      return {
        success: true,
        message: "パスワードが確認されました。村長モードを開始します。",
      };
    }

    return {
      success: false,
      message: "パスワードが正しくありません",
    };
  },
});

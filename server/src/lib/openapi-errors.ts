import { z } from "@hono/zod-openapi";

/**
 * グローバルエラーハンドラー（middleware/error-handler.ts）が返すレスポンス形式に対応する
 * OpenAPI スキーマ定義。
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.number(),
    message: z.string(),
  }),
});

const descriptions = {
  400: "リクエストエラー",
  401: "認証エラー",
  404: "リソースが見つかりません",
  500: "サーバーエラー",
} as const;

type ErrorCode = keyof typeof descriptions;

export const errorResponse = (code: ErrorCode) =>
  ({
    description: descriptions[code],
    content: {
      "application/json": { schema: ErrorResponseSchema },
    },
  }) as const;

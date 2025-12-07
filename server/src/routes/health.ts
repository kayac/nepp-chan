import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

export const healthRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const MessageResponseSchema = z.object({
  message: z.string(),
});

const healthRoute = createRoute({
  method: "get",
  path: "/",
  summary: "ヘルスチェック",
  description: "サーバーの稼働状況を確認",
  tags: ["Health"],
  responses: {
    200: {
      description: "サーバーが正常に稼働中",
      content: {
        "application/json": {
          schema: MessageResponseSchema,
        },
      },
    },
  },
});

healthRoutes.openapi(healthRoute, (c) => {
  return c.json({ message: "Hello Hono!" });
});

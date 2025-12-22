import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

type AdminBindings = CloudflareBindings & {
  ADMIN_KEY?: string;
};

export const emergencyAdminRoutes = new OpenAPIHono<{
  Bindings: AdminBindings;
}>();

emergencyAdminRoutes.use("*", async (c, next) => {
  const adminKey = c.req.header("X-Admin-Key");
  const expectedKey = c.env.ADMIN_KEY;

  if (!expectedKey) {
    throw new HTTPException(500, { message: "ADMIN_KEY is not configured" });
  }

  if (adminKey !== expectedKey) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  await next();
});

const EmergencySchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  reportedAt: z.string(),
  updatedAt: z.string().nullable(),
});

type Emergency = z.infer<typeof EmergencySchema>;

const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "緊急情報一覧を取得",
  description: "報告された緊急情報の一覧を取得します",
  tags: ["Admin - Emergency"],
  request: {
    query: z.object({
      limit: z.string().optional().default("100"),
    }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: z.object({
            emergencies: z.array(EmergencySchema),
            total: z.number(),
          }),
        },
      },
    },
    401: {
      description: "認証エラー",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
  },
});

emergencyAdminRoutes.openapi(listRoute, async (c) => {
  const { limit } = c.req.valid("query");
  const db = c.env.DB;

  const result = await db
    .prepare(
      `SELECT id, type, description, location, reported_at as reportedAt, updated_at as updatedAt
       FROM emergency_reports ORDER BY reported_at DESC LIMIT ?`,
    )
    .bind(Number(limit))
    .all<Emergency>();

  return c.json(
    {
      emergencies: result.results,
      total: result.results.length,
    },
    200,
  );
});

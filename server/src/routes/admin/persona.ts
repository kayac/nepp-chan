import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

type AdminBindings = CloudflareBindings & {
  ADMIN_KEY?: string;
};

export const personaAdminRoutes = new OpenAPIHono<{
  Bindings: AdminBindings;
}>();

personaAdminRoutes.use("*", async (c, next) => {
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

const PersonaSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  content: z.string(),
  source: z.string().nullable(),
  topic: z.string().nullable(),
  sentiment: z.string().nullable(),
  demographicSummary: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

type Persona = z.infer<typeof PersonaSchema>;

const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "ペルソナ一覧を取得",
  description: "村の集合知として蓄積されたペルソナ情報の一覧を取得します",
  tags: ["Admin - Persona"],
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
            personas: z.array(PersonaSchema),
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

personaAdminRoutes.openapi(listRoute, async (c) => {
  const { limit } = c.req.valid("query");
  const db = c.env.DB;

  const result = await db
    .prepare(
      `SELECT id, resource_id as resourceId, category, tags, content, source,
              topic, sentiment, demographic_summary as demographicSummary,
              created_at as createdAt, updated_at as updatedAt
       FROM persona ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(Number(limit))
    .all<Persona>();

  return c.json(
    {
      personas: result.results,
      total: result.results.length,
    },
    200,
  );
});

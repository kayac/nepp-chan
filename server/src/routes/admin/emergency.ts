import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { errorResponse } from "~/lib/openapi-errors";
import { sessionAuth } from "~/middleware/session-auth";
import { emergencyRepository } from "~/repository/emergency-repository";
import { emergencyReportSchema } from "~/schemas/emergency-schema";

export const emergencyAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

emergencyAdminRoutes.use("*", sessionAuth);

const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "緊急情報一覧を取得",
  description: "報告された緊急情報の一覧を取得します",
  tags: ["Admin - Emergency"],
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).optional().default(100),
    }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: z.object({
            emergencies: z.array(emergencyReportSchema),
            total: z.number(),
          }),
        },
      },
    },
    401: errorResponse(401),
  },
});

emergencyAdminRoutes.openapi(listRoute, async (c) => {
  const { limit } = c.req.valid("query");

  const results = await emergencyRepository.findAll(c.env.DB, limit);

  return c.json(
    {
      emergencies: results,
      total: results.length,
    },
    200,
  );
});

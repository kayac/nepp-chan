import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { syncAll } from "~/services/knowledge";

export const knowledgeSyncRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

const syncAllRoute = createRoute({
  method: "post",
  path: "/sync",
  summary: "全ナレッジを再同期",
  description:
    "R2 バケットの全 Markdown ファイルを同期キューに投入します。Vectorize への反映は非同期に行われます",
  tags: ["Admin - Knowledge"],
  responses: {
    200: {
      description: "投入成功",
      content: {
        "application/json": {
          schema: z.object({ message: z.string(), queued: z.number() }),
        },
      },
    },
    401: errorResponse(401),
    500: errorResponse(500),
  },
});

knowledgeSyncRoutes.openapi(syncAllRoute, async (c) => {
  const result = await syncAll(
    c.env.KNOWLEDGE_BUCKET,
    c.env.KNOWLEDGE_SYNC_QUEUE,
  );

  return c.json(
    {
      message: `${result.queued}ファイルを同期キューに投入しました`,
      queued: result.queued,
    },
    200,
  );
});

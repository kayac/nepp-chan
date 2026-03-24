import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";

export const broadcastMediaRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const getMediaRoute = createRoute({
  method: "get",
  path: "/{key}",
  summary: "配信画像を取得",
  description: "R2に保存された配信用画像を返却します",
  tags: ["Broadcast Media"],
  request: {
    params: z.object({
      key: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "画像データ",
    },
    404: errorResponse(404),
  },
});

broadcastMediaRoutes.openapi(getMediaRoute, async (c) => {
  const { key } = c.req.valid("param");

  const object = await c.env.LINE_BROADCAST_BUCKET.get(key);
  if (!object) {
    throw new HTTPException(404, { message: "画像が見つかりません" });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ?? "application/octet-stream",
  );
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import { pollRepository } from "~/repository/poll-repository";
import { pollResultsSchema } from "~/schemas/poll-schema";
import { getPollResults } from "~/services/poll-results";

export const pollRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const resultsRoute = createRoute({
  method: "get",
  path: "/{id}",
  summary: "投票結果を公開取得",
  description: "投票の集計結果を認証不要で取得します。sent/closed の投票のみ。",
  tags: ["Poll"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: pollResultsSchema,
        },
      },
    },
    404: errorResponse(404),
  },
});

pollRoutes.openapi(resultsRoute, async (c) => {
  const { id } = c.req.valid("param");

  const poll = await pollRepository.findById(c.env.DB, id);
  if (!poll) {
    throw new HTTPException(404, {
      message: "投票が見つかりません",
    });
  }

  if (poll.status !== "sent" && poll.status !== "closed") {
    throw new HTTPException(404, {
      message: "投票が見つかりません",
    });
  }

  const results = await getPollResults(c.env.DB, id);
  if (!results) {
    throw new HTTPException(404, {
      message: "投票が見つかりません",
    });
  }

  return c.json(results, 200);
});

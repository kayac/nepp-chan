import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { logger } from "~/lib/logger";
import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireAdminUser } from "~/lib/principal";
import { requireAuth } from "~/middleware/auth";
import { requireRole } from "~/middleware/require-role";
import { pollRepository } from "~/repository/poll-repository";
import {
  createPollSchema,
  pollResponseSchema,
  pollResultsSchema,
  pollStatusSchema,
  updatePollSchema,
} from "~/schemas/poll-schema";
import {
  createPoll,
  formatPollResponse,
  getPoll,
  updatePoll,
} from "~/services/poll";
import { sendPoll } from "~/services/poll-delivery";
import { getPollResults } from "~/services/poll-response";

export const pollAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

pollAdminRoutes.use("*", requireAuth);
pollAdminRoutes.use("*", requireRole("staff"));

// --- 一覧取得 ---

const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "投票一覧を取得",
  description: "投票の一覧を取得します",
  tags: ["Admin - Poll"],
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).optional().default(30),
      cursor: z.string().optional(),
      status: pollStatusSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: z.object({
            polls: z.array(pollResponseSchema),
            nextCursor: z.string().nullable(),
            hasMore: z.boolean(),
          }),
        },
      },
    },
    401: errorResponse(401),
  },
});

pollAdminRoutes.openapi(listRoute, async (c) => {
  const { limit, cursor, status } = c.req.valid("query");

  const result = await pollRepository.findAll(c.env.DB, {
    limit,
    cursor: cursor ?? undefined,
    status: status ?? undefined,
  });

  return c.json(
    {
      polls: result.polls.map(formatPollResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    },
    200,
  );
});

// --- 作成 ---

const createPollRoute = createRoute({
  method: "post",
  path: "/",
  summary: "投票を作成",
  description: "投票を作成します",
  tags: ["Admin - Poll"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createPollSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "作成成功",
      content: {
        "application/json": {
          schema: pollResponseSchema,
        },
      },
    },
    401: errorResponse(401),
  },
});

pollAdminRoutes.openapi(createPollRoute, async (c) => {
  const body = c.req.valid("json");
  const adminUser = requireAdminUser(c.get("principal"));

  try {
    const poll = await createPoll(c.env, {
      ...body,
      createdBy: adminUser.id,
    });

    if (!poll) {
      throw new HTTPException(500, {
        message: "投票の作成に失敗しました",
      });
    }

    return c.json(poll, 201);
  } catch (error) {
    logger.error("[Poll] Failed to create poll", error);
    throw new HTTPException(500, {
      message: "投票の作成に失敗しました",
    });
  }
});

// --- 詳細取得 ---

const getDetailRoute = createRoute({
  method: "get",
  path: "/{id}",
  summary: "投票詳細を取得",
  description: "投票の詳細情報を取得します",
  tags: ["Admin - Poll"],
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
          schema: pollResponseSchema,
        },
      },
    },
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

pollAdminRoutes.openapi(getDetailRoute, async (c) => {
  const { id } = c.req.valid("param");
  const poll = await getPoll(c.env.DB, id);

  if (!poll) {
    throw new HTTPException(404, {
      message: "投票が見つかりません",
    });
  }

  return c.json(poll, 200);
});

// --- 更新 ---

const updateRoute = createRoute({
  method: "put",
  path: "/{id}",
  summary: "投票を更新",
  description: "投票を更新します（draftのみ）",
  tags: ["Admin - Poll"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        "application/json": {
          schema: updatePollSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "更新成功",
      content: {
        "application/json": {
          schema: pollResponseSchema,
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

pollAdminRoutes.openapi(updateRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const existing = await pollRepository.findById(c.env.DB, id);
  if (!existing) {
    throw new HTTPException(404, {
      message: "投票が見つかりません",
    });
  }
  if (existing.status !== "draft") {
    throw new HTTPException(400, {
      message: "下書き状態の投票のみ更新できます",
    });
  }

  const updated = await updatePoll(c.env.DB, id, body);

  if (!updated) {
    throw new HTTPException(500, { message: "投票の更新に失敗しました" });
  }

  return c.json(updated, 200);
});

// --- 削除 ---

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  summary: "投票を削除",
  description: "投票を削除します（draft / scheduled のみ）",
  tags: ["Admin - Poll"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "削除成功",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

pollAdminRoutes.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");

  const existing = await pollRepository.findById(c.env.DB, id);
  if (!existing) {
    throw new HTTPException(404, {
      message: "投票が見つかりません",
    });
  }
  if (existing.status !== "draft" && existing.status !== "scheduled") {
    throw new HTTPException(400, {
      message: "下書きまたは予約済みの投票のみ削除できます",
    });
  }

  await pollRepository.delete(c.env.DB, id);
  return c.json({ message: "投票を削除しました" }, 200);
});

// --- LINE配信 ---

const sendRoute = createRoute({
  method: "post",
  path: "/{id}/send",
  summary: "投票をLINEに配信",
  description: "投票をLINE全ユーザーに配信します",
  tags: ["Admin - Poll"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "配信成功",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    404: errorResponse(404),
    500: errorResponse(500),
  },
});

pollAdminRoutes.openapi(sendRoute, async (c) => {
  const { id } = c.req.valid("param");

  const result = await sendPoll(c.env, id);
  if (!result.success) {
    const status = result.error?.includes("見つかりません") ? 404 : 400;
    throw new HTTPException(status, {
      message: result.error ?? "配信に失敗しました",
    });
  }

  return c.json({ message: "投票を配信しました" }, 200);
});

// --- 結果取得 ---

const resultsRoute = createRoute({
  method: "get",
  path: "/{id}/results",
  summary: "投票結果を取得",
  description: "投票の集計結果を取得します",
  tags: ["Admin - Poll"],
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
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

pollAdminRoutes.openapi(resultsRoute, async (c) => {
  const { id } = c.req.valid("param");

  const results = await getPollResults(c.env.DB, id);
  if (!results) {
    throw new HTTPException(404, {
      message: "投票が見つかりません",
    });
  }

  return c.json(results, 200);
});

// --- 締切 ---

const closeRoute = createRoute({
  method: "post",
  path: "/{id}/close",
  summary: "投票を締切",
  description: "投票の回答受付を締め切ります",
  tags: ["Admin - Poll"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "締切成功",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

pollAdminRoutes.openapi(closeRoute, async (c) => {
  const { id } = c.req.valid("param");

  const existing = await pollRepository.findById(c.env.DB, id);
  if (!existing) {
    throw new HTTPException(404, {
      message: "投票が見つかりません",
    });
  }
  if (existing.status !== "sent") {
    throw new HTTPException(400, {
      message: "配信済みの投票のみ締切できます",
    });
  }

  await pollRepository.update(c.env.DB, id, {
    status: "closed",
    closedAt: new Date().toISOString(),
  });

  return c.json({ message: "投票を締め切りました" }, 200);
});

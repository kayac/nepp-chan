import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import { sessionAuth } from "~/middleware/session-auth";
import { broadcastRepository } from "~/repository/broadcast-repository";
import {
  broadcastMessageSchema,
  broadcastStatusSchema,
  createBroadcastSchema,
  updateBroadcastSchema,
} from "~/schemas/broadcast-schema";
import { sendBroadcast } from "~/services/broadcast-sender";

export const broadcastAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

broadcastAdminRoutes.use("*", sessionAuth);

// 一覧
const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "配信メッセージ一覧を取得",
  description: "LINE配信メッセージの一覧を取得します",
  tags: ["Admin - Broadcast"],
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).optional().default(30),
      cursor: z.string().optional(),
      status: broadcastStatusSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: z.object({
            broadcasts: z.array(broadcastMessageSchema),
            total: z.number(),
            nextCursor: z.string().nullable(),
            hasMore: z.boolean(),
          }),
        },
      },
    },
    401: errorResponse(401),
  },
});

broadcastAdminRoutes.openapi(listRoute, async (c) => {
  const { limit, cursor, status } = c.req.valid("query");

  const result = await broadcastRepository.findAll(c.env.DB, {
    limit,
    cursor: cursor ?? undefined,
    status: status ?? undefined,
  });

  const total = await broadcastRepository.count(c.env.DB);

  return c.json(
    {
      broadcasts: result.broadcasts,
      total,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    },
    200,
  );
});

// 作成
const createBroadcastRoute = createRoute({
  method: "post",
  path: "/",
  summary: "配信メッセージを作成",
  description: "LINE配信メッセージを作成します。sendNow=trueで即時送信します",
  tags: ["Admin - Broadcast"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createBroadcastSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "作成成功",
      content: {
        "application/json": {
          schema: broadcastMessageSchema,
        },
      },
    },
    401: errorResponse(401),
    500: errorResponse(500),
  },
});

const generateTitle = (text: string) =>
  text.slice(0, 50) + (text.length > 50 ? "…" : "");

broadcastAdminRoutes.openapi(createBroadcastRoute, async (c) => {
  const body = c.req.valid("json");
  const adminUser = c.get("adminUser" as never) as { id: string };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const status = body.sendNow
    ? "draft"
    : body.scheduledAt
      ? "scheduled"
      : "draft";

  await broadcastRepository.create(c.env.DB, {
    id,
    title: generateTitle(body.body),
    body: body.body,
    status,
    scheduledAt: body.scheduledAt ?? null,
    createdBy: adminUser.id,
    createdAt: now,
  });

  if (body.sendNow) {
    const result = await sendBroadcast(c.env, id);
    if (!result.success) {
      throw new HTTPException(500, {
        message: `配信に失敗しました: ${result.error}`,
      });
    }
  }

  const broadcast = await broadcastRepository.findById(c.env.DB, id);
  if (!broadcast) {
    throw new HTTPException(500, {
      message: "作成した配信メッセージの取得に失敗しました",
    });
  }
  return c.json(broadcast, 201);
});

// 詳細
const getDetailRoute = createRoute({
  method: "get",
  path: "/{id}",
  summary: "配信メッセージ詳細を取得",
  description: "配信メッセージの詳細情報を取得します",
  tags: ["Admin - Broadcast"],
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
          schema: broadcastMessageSchema,
        },
      },
    },
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

broadcastAdminRoutes.openapi(getDetailRoute, async (c) => {
  const { id } = c.req.valid("param");

  const broadcast = await broadcastRepository.findById(c.env.DB, id);

  if (!broadcast) {
    throw new HTTPException(404, {
      message: "配信メッセージが見つかりません",
    });
  }

  return c.json(broadcast, 200);
});

// 更新
const updateRoute = createRoute({
  method: "put",
  path: "/{id}",
  summary: "配信メッセージを更新",
  description: "配信メッセージを更新します（draft/scheduled/failedのみ）",
  tags: ["Admin - Broadcast"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        "application/json": {
          schema: updateBroadcastSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "更新成功",
      content: {
        "application/json": {
          schema: broadcastMessageSchema,
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

broadcastAdminRoutes.openapi(updateRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const broadcast = await broadcastRepository.findById(c.env.DB, id);

  if (!broadcast) {
    throw new HTTPException(404, {
      message: "配信メッセージが見つかりません",
    });
  }

  if (broadcast.status === "sent") {
    throw new HTTPException(400, {
      message: "送信済みのメッセージは更新できません",
    });
  }

  const updateData: {
    title?: string;
    body?: string;
    scheduledAt?: string | null;
    status?: string;
  } = {};

  if (body.body !== undefined) {
    updateData.body = body.body;
    updateData.title = generateTitle(body.body);
  }
  if (body.scheduledAt !== undefined) {
    updateData.scheduledAt = body.scheduledAt;
    if (body.scheduledAt) {
      updateData.status = "scheduled";
    } else {
      updateData.status = "draft";
    }
  }

  await broadcastRepository.update(c.env.DB, id, updateData);

  const updated = await broadcastRepository.findById(c.env.DB, id);
  if (!updated) {
    throw new HTTPException(500, {
      message: "更新した配信メッセージの取得に失敗しました",
    });
  }
  return c.json(updated, 200);
});

// 削除
const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  summary: "配信メッセージを削除",
  description: "配信メッセージを削除します（draft/failedのみ）",
  tags: ["Admin - Broadcast"],
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

broadcastAdminRoutes.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");

  const broadcast = await broadcastRepository.findById(c.env.DB, id);

  if (!broadcast) {
    throw new HTTPException(404, {
      message: "配信メッセージが見つかりません",
    });
  }

  if (broadcast.status === "sent" || broadcast.status === "scheduled") {
    throw new HTTPException(400, {
      message: "送信済みまたは予約済みのメッセージは削除できません",
    });
  }

  await broadcastRepository.delete(c.env.DB, id);

  return c.json({ message: "配信メッセージを削除しました" }, 200);
});

// 即時送信
const sendRoute = createRoute({
  method: "post",
  path: "/{id}/send",
  summary: "配信メッセージを即時送信",
  description: "指定した配信メッセージをLINEで即時送信します",
  tags: ["Admin - Broadcast"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "送信成功",
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

broadcastAdminRoutes.openapi(sendRoute, async (c) => {
  const { id } = c.req.valid("param");

  const broadcast = await broadcastRepository.findById(c.env.DB, id);

  if (!broadcast) {
    throw new HTTPException(404, {
      message: "配信メッセージが見つかりません",
    });
  }

  if (broadcast.status === "sent") {
    throw new HTTPException(400, {
      message: "既に送信済みです",
    });
  }

  const result = await sendBroadcast(c.env, id);

  if (!result.success) {
    throw new HTTPException(500, {
      message: `配信に失敗しました: ${result.error}`,
    });
  }

  return c.json({ message: "配信を送信しました" }, 200);
});

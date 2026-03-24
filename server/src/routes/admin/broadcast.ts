import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import { type AuthVariables, requireAuth } from "~/middleware/auth";
import { broadcastRepository } from "~/repository/broadcast-repository";
import {
  broadcastMessageSchema,
  broadcastStatusSchema,
  createBroadcastSchema,
  updateBroadcastSchema,
} from "~/schemas/broadcast-schema";
import {
  createBroadcastMessage,
  sendBroadcast,
  updateBroadcastMessage,
} from "~/services/broadcast-service";

export const broadcastAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: AuthVariables;
}>();

broadcastAdminRoutes.use("*", requireAuth);

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

broadcastAdminRoutes.openapi(createBroadcastRoute, async (c) => {
  const body = c.req.valid("json");
  const adminUser = c.get("adminUser");

  try {
    const broadcast = await createBroadcastMessage(c.env, {
      ...body,
      createdBy: adminUser.id,
    });
    return c.json(broadcast, 201);
  } catch (error) {
    throw new HTTPException(500, {
      message: `配信に失敗しました: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

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

  const existing = await broadcastRepository.findById(c.env.DB, id);
  if (!existing) {
    throw new HTTPException(404, {
      message: "配信メッセージが見つかりません",
    });
  }
  if (existing.status === "sent") {
    throw new HTTPException(400, {
      message: "送信済みのメッセージは更新できません",
    });
  }

  const updated = await updateBroadcastMessage(c.env.DB, id, body);
  return c.json(updated, 200);
});

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

  if (broadcast.parts) {
    const parts = JSON.parse(broadcast.parts) as {
      type: string;
      imageR2Key?: string;
    }[];
    await Promise.all(
      parts
        .filter((p) => p.type === "image" && p.imageR2Key)
        .map((p) => c.env.LINE_BROADCAST_BUCKET.delete(p.imageR2Key as string)),
    );
  }

  await broadcastRepository.delete(c.env.DB, id);
  return c.json({ message: "配信メッセージを削除しました" }, 200);
});

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

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const uploadImageRoute = createRoute({
  method: "post",
  path: "/upload-image",
  summary: "配信用画像をアップロード",
  description: "配信用の画像をR2にアップロードします",
  tags: ["Admin - Broadcast"],
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.any(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "アップロード成功",
      content: {
        "application/json": {
          schema: z.object({ imageR2Key: z.string() }),
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
  },
});

broadcastAdminRoutes.openapi(uploadImageRoute, async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;

  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "画像ファイルが必要です" });
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new HTTPException(400, {
      message: "対応形式: JPG, PNG",
    });
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new HTTPException(400, {
      message: "ファイルサイズは10MB以下にしてください",
    });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const key = `${crypto.randomUUID()}.${ext}`;

  await c.env.LINE_BROADCAST_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return c.json({ imageR2Key: key }, 200);
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
    throw new HTTPException(400, { message: "既に送信済みです" });
  }

  const result = await sendBroadcast(c.env, id);
  if (!result.success) {
    throw new HTTPException(500, {
      message: `配信に失敗しました: ${result.error}`,
    });
  }

  return c.json({ message: "配信を送信しました" }, 200);
});

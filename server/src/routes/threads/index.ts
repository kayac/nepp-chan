import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { convertMessages } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { HTTPException } from "hono/http-exception";
import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { toResourceId } from "~/lib/principal";
import { getStorage } from "~/lib/storage";
import { requireAuth } from "~/middleware/auth";
import type { ThreadVariables } from "~/middleware/require-thread-access";
import { requireThreadAccess } from "~/middleware/require-thread-access";
import { deleteThreadWithRelatedData } from "~/services/thread";
import { chatRoutes } from "./chat";

export const threadsRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables & ThreadVariables>;
}>();

const getMemory = async (db: D1Database) => {
  const storage = await getStorage(db);
  return new Memory({ storage });
};

const ThreadSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  title: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(z.record(z.string(), z.unknown())),
});

const toThreadResponse = (t: {
  id: string;
  resourceId: string;
  title?: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown> | null;
}) => ({
  id: t.id,
  resourceId: t.resourceId,
  title: t.title ?? null,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
  metadata: t.metadata ?? null,
});

threadsRoutes.use("*", requireAuth);
threadsRoutes.use("/:threadId/*", requireThreadAccess);
threadsRoutes.use("/:threadId", requireThreadAccess);

const getThreadsRoute = createRoute({
  method: "get",
  path: "/",
  summary: "スレッド一覧取得",
  description: "セッションに紐づくスレッド一覧を取得",
  tags: ["Threads"],
  request: {
    query: z.object({
      page: z.coerce.number().int().min(0).optional().default(0),
      perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
    }),
  },
  responses: {
    200: {
      description: "スレッド一覧",
      content: {
        "application/json": {
          schema: z.object({
            threads: z.array(ThreadSchema),
            hasMore: z.boolean(),
            total: z.number(),
            page: z.number(),
            perPage: z.number(),
          }),
        },
      },
    },
  },
});

threadsRoutes.openapi(getThreadsRoute, async (c) => {
  const { page, perPage } = c.req.valid("query");
  const principal = c.get("principal");
  if (!principal) {
    throw new HTTPException(500, {
      message: "principal が middleware でセットされていない",
    });
  }
  const memory = await getMemory(c.env.DB);

  const result = await memory.listThreads({
    filter: {
      resourceId: toResourceId(principal),
    },
    page,
    perPage,
  });

  return c.json({
    threads: result.threads.map(toThreadResponse),
    hasMore: result.hasMore,
    total: result.total,
    page,
    perPage,
  });
});

const createThreadRoute = createRoute({
  method: "post",
  path: "/",
  summary: "スレッド作成",
  description: "新規スレッドを作成",
  tags: ["Threads"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            title: z.string().optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "作成されたスレッド",
      content: {
        "application/json": {
          schema: ThreadSchema,
        },
      },
    },
  },
});

threadsRoutes.openapi(createThreadRoute, async (c) => {
  const { title, metadata } = c.req.valid("json");
  const principal = c.get("principal");
  if (!principal) {
    throw new HTTPException(500, {
      message: "principal が middleware でセットされていない",
    });
  }
  const memory = await getMemory(c.env.DB);

  const thread = await memory.createThread({
    resourceId: toResourceId(principal),
    title,
    metadata,
  });

  return c.json(toThreadResponse(thread), 201);
});

const getThreadRoute = createRoute({
  method: "get",
  path: "/{threadId}",
  summary: "スレッド詳細取得",
  description: "スレッドの詳細情報を取得",
  tags: ["Threads"],
  request: {
    params: z.object({
      threadId: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "スレッド詳細",
      content: {
        "application/json": {
          schema: ThreadSchema,
        },
      },
    },
    404: errorResponse(404),
  },
});

threadsRoutes.openapi(getThreadRoute, async (c) => {
  const thread = c.get("thread");
  if (!thread) {
    throw new HTTPException(500, {
      message: "thread が middleware でセットされていない",
    });
  }
  return c.json(toThreadResponse(thread), 200);
});

const getMessagesRoute = createRoute({
  method: "get",
  path: "/{threadId}/messages",
  summary: "メッセージ履歴取得",
  description: "スレッド内のメッセージ履歴を取得",
  tags: ["Threads"],
  request: {
    params: z.object({
      threadId: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "メッセージ一覧",
      content: {
        "application/json": {
          schema: z.object({
            messages: z.array(MessageSchema),
          }),
        },
      },
    },
    404: errorResponse(404),
  },
});

threadsRoutes.openapi(getMessagesRoute, async (c) => {
  const { threadId } = c.req.valid("param");

  const memory = await getMemory(c.env.DB);

  const result = await memory.recall({ threadId });

  const uiMessages = convertMessages(result.messages).to("AIV5.UI");

  const messages = uiMessages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    parts: msg.parts,
  }));

  return c.json({ messages }, 200);
});

const deleteThreadRoute = createRoute({
  method: "delete",
  path: "/{threadId}",
  summary: "スレッド削除",
  description: "スレッドと関連データを削除",
  tags: ["Threads"],
  request: {
    params: z.object({
      threadId: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "削除成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    404: errorResponse(404),
  },
});

threadsRoutes.openapi(deleteThreadRoute, async (c) => {
  const { threadId } = c.req.valid("param");

  await deleteThreadWithRelatedData(threadId, c.env.DB);
  return c.json({ message: "スレッドを削除しました" }, 200);
});

threadsRoutes.route("/", chatRoutes);

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { D1Store } from "@mastra/cloudflare-d1";
import { HTTPException } from "hono/http-exception";

export const threadsRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const getStorage = async (db: D1Database) => {
  const storage = new D1Store({ id: "mastra-storage", binding: db });
  await storage.init();
  return storage;
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
  role: z.enum(["user", "assistant", "system", "tool", "data"]),
  content: z.string(),
});

// GET /threads - スレッド一覧取得
const getThreadsRoute = createRoute({
  method: "get",
  path: "/",
  summary: "スレッド一覧取得",
  description: "resourceId に紐づくスレッド一覧を取得",
  tags: ["Threads"],
  request: {
    query: z.object({
      resourceId: z.string().min(1, "resourceId is required"),
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
  const { resourceId, page, perPage } = c.req.valid("query");

  const storage = await getStorage(c.env.DB);

  const result = await storage.listThreadsByResourceId({
    resourceId,
    page,
    perPage,
  });

  return c.json({
    threads: result.threads.map((t) => ({
      id: t.id,
      resourceId: t.resourceId,
      title: t.title ?? null,
      createdAt:
        typeof t.createdAt === "string"
          ? t.createdAt
          : t.createdAt.toISOString(),
      updatedAt:
        typeof t.updatedAt === "string"
          ? t.updatedAt
          : t.updatedAt.toISOString(),
      metadata: t.metadata ?? null,
    })),
    hasMore: result.hasMore,
    total: result.total,
    page,
    perPage,
  });
});

// POST /threads - スレッド作成
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
            resourceId: z.string().min(1, "resourceId is required"),
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
  const { resourceId, title, metadata } = c.req.valid("json");

  const storage = await getStorage(c.env.DB);

  const now = new Date();
  const thread = await storage.saveThread({
    thread: {
      id: crypto.randomUUID(),
      resourceId,
      title: title ?? "新しい会話",
      metadata,
      createdAt: now,
      updatedAt: now,
    },
  });

  return c.json(
    {
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title ?? null,
      createdAt:
        typeof thread.createdAt === "string"
          ? thread.createdAt
          : thread.createdAt.toISOString(),
      updatedAt:
        typeof thread.updatedAt === "string"
          ? thread.updatedAt
          : thread.updatedAt.toISOString(),
      metadata: thread.metadata ?? null,
    },
    201,
  );
});

// GET /threads/:threadId - スレッド詳細取得
const getThreadRoute = createRoute({
  method: "get",
  path: "/:threadId",
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
  },
});

threadsRoutes.openapi(getThreadRoute, async (c) => {
  const { threadId } = c.req.valid("param");

  const storage = await getStorage(c.env.DB);

  const thread = await storage.getThreadById({ threadId });

  if (!thread) {
    throw new HTTPException(404, { message: "Thread not found" });
  }

  return c.json({
    id: thread.id,
    resourceId: thread.resourceId,
    title: thread.title ?? null,
    createdAt:
      typeof thread.createdAt === "string"
        ? thread.createdAt
        : thread.createdAt.toISOString(),
    updatedAt:
      typeof thread.updatedAt === "string"
        ? thread.updatedAt
        : thread.updatedAt.toISOString(),
    metadata: thread.metadata ?? null,
  });
});

// GET /threads/:threadId/messages - メッセージ履歴取得
const getMessagesRoute = createRoute({
  method: "get",
  path: "/:threadId/messages",
  summary: "メッセージ履歴取得",
  description: "スレッド内のメッセージ履歴を取得",
  tags: ["Threads"],
  request: {
    params: z.object({
      threadId: z.string().min(1),
    }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
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
  },
});

threadsRoutes.openapi(getMessagesRoute, async (c) => {
  const { threadId } = c.req.valid("param");
  const { limit } = c.req.valid("query");

  const storage = await getStorage(c.env.DB);

  const thread = await storage.getThreadById({ threadId });

  if (!thread) {
    throw new HTTPException(404, { message: "Thread not found" });
  }

  const result = await storage.listMessages({
    threadId,
    perPage: limit,
  });

  const messages = result.messages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system" | "tool" | "data",
    content:
      typeof msg.content === "string"
        ? msg.content
        : (msg.content?.content ?? ""),
  }));

  return c.json({ messages });
});

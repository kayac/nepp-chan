import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { handleChatStream } from "@mastra/ai-sdk";
import { D1Store } from "@mastra/cloudflare-d1";
import type { MastraStorage } from "@mastra/core/storage";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { createMastra } from "~/mastra/factory";
import { createRequestContext } from "~/mastra/request-context";

let cachedStorage: D1Store | null = null;

// Request Schema - UIMessage 形式をそのまま受け取る
const ChatSendRequestSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant", "system"]),
      parts: z.array(z.looseObject({ type: z.string() })),
      createdAt: z.coerce.date().optional(),
    }),
  ),
  resourceId: z.string().min(1, "resourceId is required"),
  threadId: z.string().min(1, "threadId is required"),
});

export const chatRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const getStorage = async (db: D1Database) => {
  if (cachedStorage) return cachedStorage;

  const storage = new D1Store({ id: "mastra-storage", binding: db });
  await storage.init();
  cachedStorage = storage;
  return storage;
};

const chatRoute = createRoute({
  method: "post",
  path: "/",
  summary: "ねっぷちゃんとおしゃべり",
  description:
    "ねっぷちゃん（音威子府村のAIキャラクター）にメッセージを送信し、ストリーミングレスポンスを受け取る",
  tags: ["Chat"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatSendRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "ストリーミングレスポンス",
      content: {
        "text/event-stream": {
          schema: z.string(),
        },
      },
    },
  },
});

const DEFAULT_THREAD_TITLE = "新しい会話";
const TITLE_MAX_LENGTH = 10;

const truncateTitle = (text: string): string => {
  if (text.length <= TITLE_MAX_LENGTH) return text;
  return `${text.slice(0, TITLE_MAX_LENGTH)}...`;
};

chatRoutes.openapi(chatRoute, async (c) => {
  const { messages, resourceId, threadId } = c.req.valid("json");

  const storage = await getStorage(c.env.DB);
  const mastra = createMastra(storage as unknown as MastraStorage);
  const requestContext = createRequestContext({
    storage,
    db: c.env.DB,
    env: c.env,
    masterPassword: c.env.MASTER_PASSWORD,
  });

  // スレッドタイトル更新（初回ユーザーメッセージ時のみ）
  const thread = await storage.getThreadById({ threadId });
  if (thread?.title === DEFAULT_THREAD_TITLE) {
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    const prompt =
      lastUserMessage?.parts
        ?.filter(
          (p): p is { type: "text"; text: string } =>
            typeof p === "object" && "type" in p && p.type === "text",
        )
        .map((p) => p.text)
        .join("") ?? "";

    if (prompt) {
      await storage.saveThread({
        thread: {
          ...thread,
          id: threadId,
          resourceId,
          title: truncateTitle(prompt),
          createdAt: thread.createdAt,
          updatedAt: new Date(),
        },
      });
    }
  }

  const stream = await handleChatStream({
    mastra,
    agentId: "nepChanAgent",
    params: {
      messages: messages as UIMessage[],
      requestContext,
      memory: {
        resource: resourceId,
        thread: threadId,
      },
    },
  });

  return createUIMessageStreamResponse({ stream });
});

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { handleChatStream } from "@mastra/ai-sdk";
import { D1Store } from "@mastra/cloudflare-d1";
import type { InputProcessor, ProcessInputArgs } from "@mastra/core/processors";
import type { MastraStorage } from "@mastra/core/storage";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { createMastra } from "~/mastra/factory";
import { createRequestContext } from "~/mastra/request-context";

// 空の parts を持つメッセージをフィルタリングするプロセッサ
const filterEmptyPartsProcessor: InputProcessor = {
  id: "filter-empty-parts",
  processInput: async ({ messages }: ProcessInputArgs) => {
    return messages.filter((msg) => {
      const content = msg.content;
      // MastraDBMessage の content.parts をチェック
      if (content && typeof content === "object" && "parts" in content) {
        const parts = content.parts as Array<{ type: string; text?: string }>;
        const hasNonEmptyText = parts.some(
          (part) =>
            part.type === "text" &&
            typeof part.text === "string" &&
            part.text.trim() !== "",
        );
        return hasNonEmptyText;
      }
      return true;
    });
  },
};

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

  // スレッドタイトルは nepch-agent の Memory 設定 (generateTitle: true) で自動生成される
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
      inputProcessors: [filterEmptyPartsProcessor],
    },
  });

  return createUIMessageStreamResponse({ stream });
});

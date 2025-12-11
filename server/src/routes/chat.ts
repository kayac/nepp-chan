import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { toAISdkStream } from "@mastra/ai-sdk";
import { D1Store } from "@mastra/cloudflare-d1";
import type { MastraStorage } from "@mastra/core/storage";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { createMastra } from "~/mastra/factory";
import { createRequestContext } from "~/mastra/request-context";

// Request Schema - AI SDK v5 format
const ChatSendRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    }),
  ),
  resourceId: z.string().min(1, "resourceId is required"),
  threadId: z.string().min(1, "threadId is required"),
});

export const chatRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const getStorage = async (db: D1Database) => {
  const storage = new D1Store({ id: "mastra-storage", binding: db });
  await storage.init();
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

  const agent = mastra.getAgent("nepChanAgent");
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  const prompt = lastUserMessage?.content ?? "";

  const thread = await storage.getThreadById({ threadId });
  if (thread && thread.title === DEFAULT_THREAD_TITLE && prompt) {
    await storage.saveThread({
      thread: {
        ...thread,
        title: truncateTitle(prompt),
        updatedAt: new Date(),
      },
    });
  }

  const stream = await agent.stream(prompt, {
    memory: {
      resource: resourceId,
      thread: threadId,
    },
    requestContext,
  });

  const aiSdkStream = toAISdkStream(stream, { from: "agent" });
  const uiMessageStream = createUIMessageStream({
    execute: async ({ writer }) => {
      try {
        for await (const part of aiSdkStream) {
          writer.write(part);
        }
      } catch (error) {
        console.error("Stream error:", error);
        const message =
          error instanceof Error
            ? error.message
            : "ストリーミング中にエラーが発生しました";
        writer.write({
          type: "error",
          errorText: message,
        });
      }
    },
    onError: (error) => {
      console.error("UIMessageStream error:", error);
      return error instanceof Error
        ? error.message
        : "予期しないエラーが発生しました";
    },
  });

  return createUIMessageStreamResponse({
    stream: uiMessageStream,
  });
});

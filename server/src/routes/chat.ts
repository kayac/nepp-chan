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
  resourceId: z.string().nullish(),
  threadId: z.string().nullish(),
});

export const chatRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

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

  const storage = new D1Store({ id: "mastra-storage", binding: c.env.DB });
  const mastra = createMastra(storage as unknown as MastraStorage);
  const requestContext = createRequestContext({ storage, db: c.env.DB });

  const agent = mastra.getAgent("nepChanAgent");
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  const prompt = lastUserMessage?.content ?? "";

  const stream = await agent.stream(prompt, {
    memory: {
      resource: resourceId ?? "default-user",
      thread: threadId ?? crypto.randomUUID(),
    },
    requestContext,
  });

  const aiSdkStream = toAISdkStream(stream, { from: "agent" });
  const uiMessageStream = createUIMessageStream({
    execute: async ({ writer }) => {
      for await (const part of aiSdkStream) {
        writer.write(part);
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: uiMessageStream,
  });
});

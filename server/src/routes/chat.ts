import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { D1Store } from "@mastra/cloudflare-d1";
import { stream } from "hono/streaming";
import { createMastra } from "~/mastra/factory";
import { createRequestContext } from "~/mastra/runtime-context";

// Request Schema
const ChatSendRequestSchema = z.object({
  message: z.string().min(1),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
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
  const { message, resourceId, threadId } = c.req.valid("json");

  const storage = new D1Store({ id: "mastra-storage", binding: c.env.DB });
  const mastra = createMastra(storage);
  const requestContext = createRequestContext({ storage, db: c.env.DB });

  const agent = mastra.getAgent("nepChanAgent");
  const response = await agent.stream(message, {
    resourceId: resourceId ?? "default-user",
    threadId: threadId ?? crypto.randomUUID(),
    requestContext,
  });

  return stream(c, async (s) => {
    for await (const chunk of response.textStream) {
      await s.write(chunk);
    }
  });
});

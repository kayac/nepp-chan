import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { handleChatStream } from "@mastra/ai-sdk";
import { Mastra } from "@mastra/core/mastra";
import { createUIMessageStreamResponse, type UIMessage } from "ai";

import { getTokenFromHeader } from "~/lib/auth-header";
import { getStorage } from "~/lib/storage";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";
import { getUserFromSession } from "~/services/auth/session";

const ChatSendRequestSchema = z.object({
  message: z.object({
    id: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(z.looseObject({ type: z.string() })),
    createdAt: z.coerce.date().optional(),
  }),
  resourceId: z.string().min(1, "resourceId is required"),
  threadId: z.string().min(1, "threadId is required"),
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
  const storage = await getStorage(c.env.DB);

  const sessionId = getTokenFromHeader(c);
  const adminUser = sessionId
    ? await getUserFromSession(c.env.DB, sessionId)
    : null;

  const neppChanAgent = createNeppChanAgent({ isAdmin: !!adminUser });
  const mastra = new Mastra({
    agents: { neppChanAgent },
    storage,
  });

  const requestContext = createRequestContext({
    storage,
    db: c.env.DB,
    env: c.env,
    adminUser: adminUser ?? undefined,
  });

  try {
    const stream = await handleChatStream({
      mastra,
      agentId: "neppChanAgent",
      params: {
        messages: [message] as UIMessage[],
        requestContext,
        memory: {
          resource: resourceId,
          thread: threadId,
        },
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Chat stream error:", error);
    throw error;
  }
});

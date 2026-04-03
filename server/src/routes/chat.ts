import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { handleChatStream } from "@mastra/ai-sdk";
import { Mastra } from "@mastra/core/mastra";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { classifyIntent } from "~/lib/classify-intent";
import { resolveModelTier } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { getStorage } from "~/lib/storage";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";
import type { AuthVariables } from "~/middleware/auth";
import type { SessionVariables } from "~/middleware/resolve-session";
import { verifyThreadOwnership } from "~/services/thread";

const ChatSendRequestSchema = z.object({
  message: z.object({
    id: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(z.looseObject({ type: z.string() })),
    createdAt: z.coerce.date().optional(),
  }),
  threadId: z.string().min(1, "threadId is required"),
  intent: z.enum(["casual", "normal", "thinking"]).optional(),
});

export const chatRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<AuthVariables & SessionVariables>;
}>();

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
  const { message, threadId, intent: fixedIntent } = c.req.valid("json");

  const thread = await verifyThreadOwnership(
    threadId,
    c.get("sessionResourceId"),
    c.env.DB,
  );

  logger.info(`[Chat] request received`, {
    threadId,
    resourceId: thread.resourceId,
  });

  const adminUser = c.get("adminUser");
  const isAdmin = !!adminUser;

  const storage = await getStorage(c.env.DB);

  // Intent 分類でモデルティアを決定（fixedIntent 指定時はルータースキップ）
  const userText = (
    message.parts.find((p) => p.type === "text") as
      | { type: string; text: string }
      | undefined
  )?.text;
  const intent =
    fixedIntent ??
    (isAdmin ? "thinking" : await classifyIntent(userText ?? ""));
  const modelConfig = resolveModelTier({ intent, platform: "web", isAdmin });
  logger.info(`[Chat] intent: ${intent}`, { threadId });

  const neppChanAgent = createNeppChanAgent({
    isAdmin,
    modelConfig,
  });
  const mastra = new Mastra({
    agents: { neppChanAgent },
    storage,
  });

  const requestContext = createRequestContext({
    storage,
    db: c.env.DB,
    env: c.env,
    adminUser,
  });

  const stream = await handleChatStream({
    mastra,
    agentId: "neppChanAgent",
    params: {
      messages: [message] as UIMessage[],
      requestContext,
      memory: {
        resource: thread.resourceId,
        thread: threadId,
      },
    },
  });

  return createUIMessageStreamResponse({ stream });
});

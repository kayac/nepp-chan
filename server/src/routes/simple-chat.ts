import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { handleChatStream } from "@mastra/ai-sdk";
import { Mastra } from "@mastra/core/mastra";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { resolveModelTier } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";

export const simpleChatRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const SimpleChatRequestSchema = z.object({
  message: z.object({
    id: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(z.looseObject({ type: z.string() })),
    createdAt: z.coerce.date().optional(),
  }),
});

const simpleChatRoute = createRoute({
  method: "post",
  path: "/",
  summary: "シンプルなチャット (履歴保存なし)",
  description:
    "履歴を保持しない 1 往復のシンプルなチャットエンドポイント。LP の MiniChat やウィジェット埋め込みなど、その場限りの応答用途を想定する。",
  tags: ["Chat"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SimpleChatRequestSchema,
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

simpleChatRoutes.openapi(simpleChatRoute, async (c) => {
  const { message } = c.req.valid("json");

  logger.info("[SimpleChat] request received");

  const modelConfig = resolveModelTier({
    intent: "casual",
    platform: "web",
    isAdmin: false,
  });

  const neppChanAgent = createNeppChanAgent({
    isAdmin: false,
    modelConfig,
    withMemory: false,
  });
  const mastra = new Mastra({
    agents: { neppChanAgent },
  });

  const requestContext = createRequestContext({
    db: c.env.DB,
    env: c.env,
  });

  const stream = await handleChatStream({
    mastra,
    agentId: "neppChanAgent",
    params: {
      messages: [message] as UIMessage[],
      requestContext,
    },
  });

  return createUIMessageStreamResponse({ stream });
});

import { waitUntil } from "cloudflare:workers";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { Mastra } from "@mastra/core/mastra";
import { respondWithChatStream } from "~/lib/chat-stream";
import { classifyIntent } from "~/lib/classify-intent";
import { primaryModelId, resolveModelTier } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import type { PrincipalVariables } from "~/lib/principal";
import { getStorage } from "~/lib/storage";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";
import { requireAuth } from "~/middleware/auth";
import type { ThreadVariables } from "~/middleware/require-thread-access";
import { requireThreadAccess } from "~/middleware/require-thread-access";
import { widgetSiteRepository } from "~/repository/widget-site-repository";
import { nextTurnIndex, recordLlmUsage } from "~/services/analytics/llm-usage";

export const chatRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables & ThreadVariables>;
}>();

const ChatSendRequestSchema = z.object({
  message: z.object({
    id: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(z.looseObject({ type: z.string() })),
    createdAt: z.coerce.date().optional(),
  }),
  intent: z.enum(["casual", "thinking"]).optional(),
  siteHost: z.string().max(255).optional(),
});

const chatRoute = createRoute({
  method: "post",
  path: "/{threadId}/chat",
  middleware: [requireAuth, requireThreadAccess] as const,
  summary: "ねっぷちゃんとおしゃべり",
  description:
    "ねっぷちゃん（音威子府村のAIキャラクター）にメッセージを送信し、ストリーミングレスポンスを受け取る",
  tags: ["Chat"],
  request: {
    params: z.object({
      threadId: z.string().min(1),
    }),
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
  const { threadId } = c.req.valid("param");
  const { message, intent: fixedIntent, siteHost } = c.req.valid("json");
  const thread = c.get("thread");
  const principal = c.get("principal");

  logger.info(`[Chat] request received`, {
    threadId,
    resourceId: thread.resourceId,
  });

  const isAdmin = principal.type === "admin";
  const adminUser = isAdmin ? principal.user : undefined;
  const enableAdminAgents = isAdmin && adminUser?.role !== "staff";
  // widget 由来の resourceId は widget- prefix を持つ（server/src/lib/principal.ts の
  // line:/admin: と同じ、resourceId prefix でチャネルを区別する規約）
  const platform = thread.resourceId.startsWith("widget-") ? "widget" : "web";
  const site =
    platform === "widget" && siteHost
      ? await widgetSiteRepository.findByHost(c.env.DB, siteHost)
      : null;

  const storage = await getStorage(c.env.DB);
  const turnIndex = await nextTurnIndex(c.env.DB, threadId);
  const startedAt = Date.now();

  const requestContext = createRequestContext({
    storage,
    db: c.env.DB,
    env: c.env,
    adminUser,
    usagePlatform: platform,
    usageThreadId: threadId,
    usageTurnIndex: turnIndex,
  });

  // Intent 分類でモデルティアを決定（fixedIntent 指定時はルータースキップ）
  const userText = (
    message.parts.find((p) => p.type === "text") as
      | { type: string; text: string }
      | undefined
  )?.text;
  const intent =
    fixedIntent ?? (await classifyIntent(userText ?? "", requestContext));
  const modelConfig = resolveModelTier({ intent, platform: "web", isAdmin });
  logger.info(`[Chat] intent: ${intent}`, { threadId });

  const neppChanAgent = createNeppChanAgent({
    isAdmin: enableAdminAgents,
    modelConfig,
    platform,
    siteInstructions: site?.instructions,
  });
  const mastra = new Mastra({
    agents: { neppChanAgent },
    storage,
  });

  return respondWithChatStream({
    mastra,
    agentId: "neppChanAgent",
    messages: [message],
    requestContext,
    memory: {
      resource: thread.resourceId,
      thread: threadId,
    },
    // onFinish はレスポンス返却後に発火するため waitUntil で記録を完了させる
    onFinish: (event) =>
      waitUntil(
        recordLlmUsage(c.env.DB, {
          model: event.model?.modelId ?? primaryModelId(modelConfig),
          usage: event.totalUsage,
          platform,
          source: "chat",
          agent: "nepp-chan",
          intent,
          threadId,
          turnIndex,
          durationMs: Date.now() - startedAt,
        }),
      ),
  });
});

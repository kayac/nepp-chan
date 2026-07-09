import { waitUntil } from "cloudflare:workers";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { Mastra } from "@mastra/core/mastra";
import { SIMPLE_CHAT_MAX_MESSAGES } from "@nepp-chan/shared/constants/simple-chat";
import { respondWithChatStream } from "~/lib/chat-stream";
import { primaryModelId, resolveModelTier } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { createRequestContext } from "~/mastra/request-context";
import { recordLlmUsage } from "~/services/analytics/llm-usage";

export const simpleChatRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const MAX_TOTAL_TEXT_LENGTH = 8000;
const MAX_PARTS_PER_MESSAGE = 50;

const TextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const ChatMessageSchema = z.object({
  id: z.string().max(128),
  role: z.enum(["user", "assistant"]),
  parts: z
    .array(z.unknown())
    .max(MAX_PARTS_PER_MESSAGE)
    .transform((parts) =>
      parts.flatMap((part) => {
        const parsed = TextPartSchema.safeParse(part);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  createdAt: z.coerce.date().optional(),
});

type ChatMessage = z.infer<typeof ChatMessageSchema>;

const messageTextLength = (message: ChatMessage) =>
  message.parts.reduce((sum, part) => sum + part.text.length, 0);

const SimpleChatRequestSchema = z
  .object({
    message: ChatMessageSchema.optional(),
    messages: z
      .array(ChatMessageSchema)
      .min(1)
      .max(SIMPLE_CHAT_MAX_MESSAGES)
      .optional(),
  })
  .transform((body, ctx) => {
    const messages = body.messages ?? (body.message ? [body.message] : []);
    if (messages.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "message または messages のいずれかが必須です",
        path: ["messages"],
      });
      return z.NEVER;
    }
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      ctx.addIssue({
        code: "custom",
        message: "最後のメッセージは user である必要があります",
        path: ["messages"],
      });
      return z.NEVER;
    }
    const lastLength = messageTextLength(lastMessage);
    if (lastLength > MAX_TOTAL_TEXT_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: `メッセージは ${MAX_TOTAL_TEXT_LENGTH} 文字以内にしてください`,
        path: ["messages"],
      });
      return z.NEVER;
    }
    if (lastLength === 0) {
      ctx.addIssue({
        code: "custom",
        message: "メッセージが空です",
        path: ["messages"],
      });
      return z.NEVER;
    }

    const trimmedHistory: ChatMessage[] = [];
    let historyTotal = 0;
    for (let i = messages.length - 2; i >= 0; i--) {
      const candidate = messages[i];
      const length = messageTextLength(candidate);
      if (length === 0) continue;
      if (historyTotal + length > MAX_TOTAL_TEXT_LENGTH) break;
      historyTotal += length;
      trimmedHistory.unshift(candidate);
    }

    return { messages: [...trimmedHistory, lastMessage] };
  });

const simpleChatRoute = createRoute({
  method: "post",
  path: "/",
  summary: "シンプルなチャット (履歴保存なし)",
  description:
    "履歴を保持しない、その場限りの応答用のチャットエンドポイント。LP のティーザーやウィジェット埋め込みを想定する。" +
    "サーバー側での履歴保存は行わないため、文脈を維持したい場合はリクエストの `messages`（直近最大 10 件、最後は user）に含める。" +
    "合計 8000 字を超える分は古い履歴から自動的に切り捨てられる（最後の user メッセージ単体が 8000 字を超える場合はエラー）。" +
    "後方互換のため単発メッセージの `message` も受け付ける。",
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
  const { messages } = c.req.valid("json");

  logger.info("[SimpleChat] request received");

  const modelConfig = resolveModelTier({
    intent: "casual",
    platform: "web",
    isAdmin: false,
  });

  const neppChanAgent = createNeppChanAgent({
    isAdmin: false,
    platform: "widget",
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

  return respondWithChatStream({
    mastra,
    agentId: "neppChanAgent",
    messages,
    requestContext,
    // onFinish はレスポンス返却後に発火するため waitUntil で記録を完了させる
    onFinish: (event) =>
      waitUntil(
        recordLlmUsage(c.env.DB, {
          model: event.model?.modelId ?? primaryModelId(modelConfig),
          usage: event.totalUsage,
          platform: "lp",
          source: "chat",
          intent: "casual",
        }),
      ),
  });
});

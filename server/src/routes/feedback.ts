import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { feedbackRepository } from "~/repository/feedback-repository";
import {
  conversationContextSchema,
  toolExecutionSchema,
} from "~/schemas/feedback-schema";

export const feedbackRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const FeedbackCreateRequestSchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  messageId: z.string().min(1, "messageId is required"),
  rating: z.enum(["good", "bad", "idea"]),
  category: z
    .enum([
      "incorrect_fact",
      "outdated_info",
      "nonexistent_info",
      "off_topic",
      "other",
    ])
    .optional(),
  comment: z.string().max(1000).optional(),
  conversationContext: conversationContextSchema,
  toolExecutions: z.array(toolExecutionSchema).optional(),
});

const FeedbackResponseSchema = z.object({
  id: z.string(),
});

const createFeedbackRoute = createRoute({
  method: "post",
  path: "/",
  summary: "フィードバック送信",
  description: "ねっぷちゃんの回答に対するフィードバックを送信",
  tags: ["Feedback"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: FeedbackCreateRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "フィードバック送信成功",
      content: {
        "application/json": {
          schema: FeedbackResponseSchema,
        },
      },
    },
  },
});

feedbackRoutes.openapi(createFeedbackRoute, async (c) => {
  const body = c.req.valid("json");

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await feedbackRepository.create(c.env.DB, {
    id,
    threadId: body.threadId,
    messageId: body.messageId,
    rating: body.rating,
    category: body.category ?? null,
    comment: body.comment ?? null,
    conversationContext: JSON.stringify(body.conversationContext),
    toolExecutions: body.toolExecutions
      ? JSON.stringify(body.toolExecutions)
      : null,
    createdAt,
  });

  return c.json({ id }, 201);
});

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import type { ReviewDecision } from "~/db";
import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireAdminUser } from "~/lib/principal";
import { requireRole } from "~/middleware/require-role";
import { feedbackRepository } from "~/repository/feedback-repository";
import {
  REVIEW_DECISIONS,
  type ReviewQueueRow,
  reviewRepository,
} from "~/repository/review-repository";
import { feedbackFullSchema } from "~/schemas/feedback-schema";
import { parseFeedback } from "~/services/feedback";
import type { RetrievalHit } from "~/services/knowledge/retrieval-trace";
import { getAnswerConversation } from "~/services/review";
import {
  buildDecisionEvidence,
  type DecisionEvidence,
} from "~/services/review-evidence";

export const reviewAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

reviewAdminRoutes.use("*", requireRole("admin"));

const FlagsSchema = z.object({
  zeroHit: z.boolean(),
  webFallback: z.boolean(),
  badFeedback: z.boolean(),
});

const QueueItemSchema = z.object({
  answerRunId: z.string(),
  threadId: z.string().nullable(),
  messageId: z.string().nullable(),
  turnIndex: z.number().nullable(),
  createdAt: z.string(),
  searchCount: z.number(),
  queries: z.array(z.string()),
  flags: FlagsSchema,
  decision: z.enum(REVIEW_DECISIONS).nullable(),
  decidedAt: z.string().nullable(),
});

const toDecisionResponse = (decision: ReviewDecision) => ({
  id: decision.id,
  decision: decision.decision as (typeof REVIEW_DECISIONS)[number],
  comment: decision.comment,
  reviewedBy: decision.reviewedBy,
  createdAt: decision.createdAt,
});

const parseEvidence = (decisions: ReviewDecision[]) => {
  const stored = decisions.find((decision) => decision.evidence);
  if (!stored?.evidence) return null;
  return JSON.parse(stored.evidence) as DecisionEvidence;
};

const toQueueItem = (row: ReviewQueueRow) => ({
  answerRunId: row.answerRunId,
  threadId: row.threadId,
  messageId: row.messageId,
  turnIndex: row.turnIndex,
  createdAt: row.createdAt,
  searchCount: row.searchCount,
  queries: JSON.parse(row.queries) as string[],
  flags: {
    zeroHit: row.totalHits === 0,
    webFallback: Boolean(row.webFallback),
    badFeedback: row.feedbackId !== null,
  },
  decision: row.decision as (typeof REVIEW_DECISIONS)[number] | null,
  decidedAt: row.decidedAt,
});

const listQueueRoute = createRoute({
  method: "get",
  path: "/",
  summary: "要確認の回答一覧を取得",
  description:
    "bad 評価・ナレッジ検索 0 件・Web フォールバックのいずれかに該当する回答を一覧します",
  tags: ["Admin - Review"],
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(30),
      cursor: z.string().optional(),
      decided: z
        .enum(["true", "false"])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === "true")),
    }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: z.object({
            items: z.array(QueueItemSchema),
            nextCursor: z.string().nullable(),
            hasMore: z.boolean(),
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

reviewAdminRoutes.openapi(listQueueRoute, async (c) => {
  const { limit, cursor, decided } = c.req.valid("query");

  const result = await reviewRepository.listQueue(c.env.DB, {
    limit,
    cursor,
    decided,
  });

  return c.json(
    {
      items: result.items.map(toQueueItem),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    },
    200,
  );
});

const RunSchema = z.object({
  query: z.string(),
  hits: z.array(
    z.object({
      source: z.string(),
      title: z.string().optional(),
      section: z.string().optional(),
      score: z.number(),
      rerankScore: z.number().optional(),
      contentHash: z.string().optional(),
    }),
  ),
  durationMs: z.number().nullable(),
  createdAt: z.string(),
});

const DecisionSchema = z.object({
  id: z.string(),
  decision: z.enum(REVIEW_DECISIONS),
  comment: z.string().nullable(),
  reviewedBy: z.string(),
  createdAt: z.string(),
});

const EvidenceSchema = z.object({
  question: z.string().nullable(),
  answer: z.string().nullable(),
  runs: z.array(z.object({ query: z.string(), sources: z.array(z.string()) })),
});

const DetailSchema = z.object({
  answerRunId: z.string(),
  threadId: z.string().nullable(),
  messageId: z.string().nullable(),
  turnIndex: z.number().nullable(),
  createdAt: z.string(),
  flags: FlagsSchema,
  runs: z.array(RunSchema),
  conversation: z
    .object({
      question: z.string().nullable(),
      answer: z.string(),
    })
    .nullable(),
  archivedEvidence: EvidenceSchema.nullable(),
  feedbacks: z.array(feedbackFullSchema),
  decisions: z.array(DecisionSchema),
});

const detailRoute = createRoute({
  method: "get",
  path: "/{answerRunId}",
  summary: "要確認回答の詳細を取得",
  description: "質問・回答・検索の根拠・ユーザー評価・判断履歴を返します",
  tags: ["Admin - Review"],
  request: {
    params: z.object({ answerRunId: z.string().min(1) }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: { "application/json": { schema: DetailSchema } },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
  },
});

reviewAdminRoutes.openapi(detailRoute, async (c) => {
  const { answerRunId } = c.req.valid("param");

  const [runs, decisions] = await Promise.all([
    reviewRepository.listRunsByAnswerRunId(c.env.DB, answerRunId),
    reviewRepository.listDecisions(c.env.DB, answerRunId),
  ]);
  if (runs.length === 0 && decisions.length === 0) {
    throw new HTTPException(404, { message: "回答が見つかりません" });
  }

  const archivedEvidence = parseEvidence(decisions);

  if (runs.length === 0) {
    const decided = decisions[0];
    return c.json(
      {
        answerRunId,
        threadId: decided.threadId,
        messageId: null,
        turnIndex: null,
        createdAt: decided.createdAt,
        flags: {
          zeroHit:
            archivedEvidence?.runs.every((run) => run.sources.length === 0) ??
            false,
          webFallback: false,
          badFeedback: decisions.some((decision) => decision.feedbackId),
        },
        runs: [],
        conversation: null,
        archivedEvidence,
        feedbacks: [],
        decisions: decisions.map(toDecisionResponse),
      },
      200,
    );
  }

  const threadId = runs[0].threadId;
  const messageId = runs.find((run) => run.messageId)?.messageId ?? null;
  const turnIndex = runs[0].turnIndex;

  const parsedRuns = runs.map((run) => ({
    query: run.query,
    hits: JSON.parse(run.hits) as RetrievalHit[],
    durationMs: run.durationMs,
    createdAt: run.createdAt,
  }));

  const [webFallback, feedbacks, conversation] = await Promise.all([
    threadId
      ? reviewRepository.hasWebFallback(c.env.DB, threadId, turnIndex)
      : false,
    messageId
      ? reviewRepository.findBadFeedbackByMessageId(c.env.DB, messageId)
      : [],
    getAnswerConversation(c.env.DB, { threadId, messageId, turnIndex }),
  ]);

  return c.json(
    {
      answerRunId,
      threadId,
      messageId,
      turnIndex,
      createdAt: runs[0].createdAt,
      flags: {
        zeroHit: parsedRuns.every((run) => run.hits.length === 0),
        webFallback,
        badFeedback: feedbacks.some((f) => f.rating === "bad"),
      },
      runs: parsedRuns,
      conversation,
      archivedEvidence: conversation ? null : archivedEvidence,
      feedbacks: feedbacks.map(parseFeedback),
      decisions: decisions.map(toDecisionResponse),
    },
    200,
  );
});

const decideRoute = createRoute({
  method: "post",
  path: "/{answerRunId}/decision",
  summary: "要確認回答への判断を記録",
  description:
    "問題なし / 誤り / 情報源不足 のいずれかを記録します。bad 評価があれば解決済みにします",
  tags: ["Admin - Review"],
  request: {
    params: z.object({ answerRunId: z.string().min(1) }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            decision: z.enum(REVIEW_DECISIONS),
            comment: z.string().max(2000).optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "記録成功",
      content: {
        "application/json": {
          schema: z.object({ message: z.string(), decision: DecisionSchema }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
  },
});

reviewAdminRoutes.openapi(decideRoute, async (c) => {
  const { answerRunId } = c.req.valid("param");
  const { decision, comment } = c.req.valid("json");
  const adminUser = requireAdminUser(c.get("principal"));

  const runs = await reviewRepository.listRunsByAnswerRunId(
    c.env.DB,
    answerRunId,
  );
  if (runs.length === 0) {
    throw new HTTPException(404, { message: "回答が見つかりません" });
  }

  const threadId = runs[0].threadId;
  const messageId = runs.find((run) => run.messageId)?.messageId ?? null;
  const badFeedback = messageId
    ? (
        await reviewRepository.findBadFeedbackByMessageId(c.env.DB, messageId)
      ).find((f) => f.rating === "bad")
    : undefined;

  const conversation = await getAnswerConversation(c.env.DB, {
    threadId,
    messageId,
    turnIndex: runs[0].turnIndex,
  });
  const evidence = await buildDecisionEvidence({
    conversation,
    runs: runs.map((run) => ({
      query: run.query,
      hits: JSON.parse(run.hits) as RetrievalHit[],
    })),
  });

  const inserted = await reviewRepository.insertDecision(c.env.DB, {
    id: crypto.randomUUID(),
    answerRunId,
    threadId,
    feedbackId: badFeedback?.id,
    decision,
    comment,
    evidence: JSON.stringify(evidence),
    reviewedBy: adminUser.id,
    createdAt: new Date().toISOString(),
  });

  if (badFeedback && !badFeedback.resolvedAt) {
    await feedbackRepository.resolve(c.env.DB, badFeedback.id);
  }

  return c.json(
    {
      message: "判断を記録しました",
      decision: toDecisionResponse(inserted),
    },
    200,
  );
});

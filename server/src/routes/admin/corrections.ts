import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireAdminUser } from "~/lib/principal";
import { requireRole } from "~/middleware/require-role";
import {
  type KnowledgeCorrection,
  knowledgeCorrectionRepository,
  NEEDS_REVIEW_REASONS,
  type NeedsReviewReason,
} from "~/repository/knowledge-correction-repository";
import { knowledgeSourceRepository } from "~/repository/knowledge-source-repository";
import {
  correctionSourcePath,
  publishCorrection,
} from "~/services/knowledge/corrections";
import { removeKnowledgeSource } from "~/services/knowledge/indexing";
import { requireApiKey } from "./knowledge/schemas";

export const correctionsAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

correctionsAdminRoutes.use("*", requireRole("admin"));

const CorrectionSchema = z.object({
  id: z.string(),
  correctsSourcePath: z.string(),
  body: z.string(),
  status: z.enum(["draft", "published", "retired"]),
  verifiedAt: z.string(),
  approvedBy: z.string(),
  relatedFeedbackId: z.string().nullable(),
  answerRunId: z.string().nullable(),
  needsReviewAt: z.string().nullable(),
  needsReviewReason: z.enum(NEEDS_REVIEW_REASONS).nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

const toCorrectionResponse = (correction: KnowledgeCorrection) => ({
  id: correction.id,
  correctsSourcePath: correction.correctsSourcePath,
  body: correction.body,
  status: correction.status as "draft" | "published" | "retired",
  verifiedAt: correction.verifiedAt,
  approvedBy: correction.approvedBy,
  relatedFeedbackId: correction.relatedFeedbackId,
  answerRunId: correction.answerRunId,
  needsReviewAt: correction.needsReviewAt,
  needsReviewReason: correction.needsReviewReason as NeedsReviewReason | null,
  createdAt: correction.createdAt,
  updatedAt: correction.updatedAt,
});

const publishDeps = (env: CloudflareBindings) => ({
  d1: env.DB,
  bucket: env.KNOWLEDGE_BUCKET,
  vectorize: env.VECTORIZE,
  apiKey: requireApiKey(env.GOOGLE_GENERATIVE_AI_API_KEY),
});

const publishOrFail = async (
  env: CloudflareBindings,
  correction: KnowledgeCorrection,
  options: { canonicalUrl?: string } = {},
) => {
  const canonicalUrl =
    options.canonicalUrl ??
    (
      await knowledgeSourceRepository.findByPath(
        env.DB,
        correction.correctsSourcePath,
      )
    )?.canonicalUrl ??
    undefined;
  const result = await publishCorrection(publishDeps(env), correction, {
    canonicalUrl,
  });
  if (result.error) {
    throw new HTTPException(500, {
      message: `訂正の反映に失敗しました。再発行してください: ${result.error}`,
    });
  }
};

const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "訂正一覧を取得",
  description: "村が発行したナレッジ訂正の一覧を返します",
  tags: ["Admin - Corrections"],
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: z.object({ corrections: z.array(CorrectionSchema) }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

correctionsAdminRoutes.openapi(listRoute, async (c) => {
  const corrections = await knowledgeCorrectionRepository.list(c.env.DB);
  return c.json({ corrections: corrections.map(toCorrectionResponse) }, 200);
});

const createRoute_ = createRoute({
  method: "post",
  path: "/",
  summary: "訂正を発行",
  description:
    "元ナレッジを書き換えずに、村が確認した訂正を curated ナレッジとして発行します",
  tags: ["Admin - Corrections"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            correctsSourcePath: z.string().min(1),
            body: z.string().min(1).max(4000),
            relatedFeedbackId: z.string().optional(),
            answerRunId: z.string().optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "発行成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            correction: CorrectionSchema,
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
    500: errorResponse(500),
  },
});

correctionsAdminRoutes.openapi(createRoute_, async (c) => {
  const { correctsSourcePath, body, relatedFeedbackId, answerRunId } =
    c.req.valid("json");
  const adminUser = requireAdminUser(c.get("principal"));

  const source = await knowledgeSourceRepository.findByPath(
    c.env.DB,
    correctsSourcePath,
  );
  if (!source) {
    throw new HTTPException(404, {
      message: "訂正対象の情報源が見つかりません",
    });
  }
  if (source.approvalStatus !== "approved") {
    throw new HTTPException(400, {
      message:
        "訂正対象の情報源が検索対象から外れています。情報源を承認し直してください",
    });
  }

  const now = new Date();
  const draft = await knowledgeCorrectionRepository.insert(c.env.DB, {
    id: crypto.randomUUID(),
    correctsSourcePath,
    body,
    status: "draft",
    verifiedAt: now.toISOString().slice(0, 10),
    approvedBy: adminUser.id,
    relatedFeedbackId,
    answerRunId,
    createdAt: now.toISOString(),
  });

  await publishOrFail(c.env, draft, {
    canonicalUrl: source.canonicalUrl ?? undefined,
  });

  const published = await knowledgeCorrectionRepository.update(
    c.env.DB,
    draft.id,
    { status: "published" },
  );

  return c.json(
    {
      message: "訂正を発行しました",
      correction: toCorrectionResponse(published),
    },
    200,
  );
});

const updateRoute = createRoute({
  method: "patch",
  path: "/{id}",
  summary: "訂正の本文を修正",
  description: "本文を書き換え、確認日を更新して R2 と検索へ再反映します",
  tags: ["Admin - Corrections"],
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ body: z.string().min(1).max(4000) }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "修正成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            correction: CorrectionSchema,
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
    500: errorResponse(500),
  },
});

correctionsAdminRoutes.openapi(updateRoute, async (c) => {
  const { id } = c.req.valid("param");
  const { body } = c.req.valid("json");
  const adminUser = requireAdminUser(c.get("principal"));

  const correction = await knowledgeCorrectionRepository.findById(c.env.DB, id);
  if (!correction || correction.status === "retired") {
    throw new HTTPException(404, { message: "訂正が見つかりません" });
  }

  const verifiedAt = new Date().toISOString().slice(0, 10);
  await publishOrFail(c.env, {
    ...correction,
    body,
    verifiedAt,
    approvedBy: adminUser.id,
  });

  const updated = await knowledgeCorrectionRepository.update(c.env.DB, id, {
    body,
    verifiedAt,
    approvedBy: adminUser.id,
    status: "published",
    needsReviewAt: null,
    needsReviewReason: null,
  });

  return c.json(
    {
      message: "訂正を修正しました",
      correction: toCorrectionResponse(updated),
    },
    200,
  );
});

const retireRoute = createRoute({
  method: "post",
  path: "/{id}/retire",
  summary: "訂正を廃止",
  description: "訂正を検索対象から外します。記録は履歴として残ります",
  tags: ["Admin - Corrections"],
  request: {
    params: z.object({ id: z.string().min(1) }),
  },
  responses: {
    200: {
      description: "廃止成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            correction: CorrectionSchema,
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
  },
});

correctionsAdminRoutes.openapi(retireRoute, async (c) => {
  const { id } = c.req.valid("param");

  const correction = await knowledgeCorrectionRepository.findById(c.env.DB, id);
  if (!correction) {
    throw new HTTPException(404, { message: "訂正が見つかりません" });
  }

  const path = correctionSourcePath(id);
  await c.env.KNOWLEDGE_BUCKET.delete(path);
  await removeKnowledgeSource(path, {
    d1: c.env.DB,
    vectorize: c.env.VECTORIZE,
  });

  const updated = await knowledgeCorrectionRepository.update(c.env.DB, id, {
    status: "retired",
    needsReviewAt: null,
    needsReviewReason: null,
  });

  return c.json(
    {
      message: "訂正を廃止しました",
      correction: toCorrectionResponse(updated),
    },
    200,
  );
});

const reverifyRoute = createRoute({
  method: "post",
  path: "/{id}/reverify",
  summary: "訂正を再確認済みにする",
  description:
    "元ナレッジの更新後も訂正が有効であることを確認し、確認日を更新して再発行します",
  tags: ["Admin - Corrections"],
  request: {
    params: z.object({ id: z.string().min(1) }),
  },
  responses: {
    200: {
      description: "再確認成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            correction: CorrectionSchema,
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
    500: errorResponse(500),
  },
});

correctionsAdminRoutes.openapi(reverifyRoute, async (c) => {
  const { id } = c.req.valid("param");
  const adminUser = requireAdminUser(c.get("principal"));

  const correction = await knowledgeCorrectionRepository.findById(c.env.DB, id);
  if (!correction || correction.status !== "published") {
    throw new HTTPException(404, {
      message: "公開中の訂正が見つかりません",
    });
  }

  const verifiedAt = new Date().toISOString().slice(0, 10);
  await publishOrFail(c.env, {
    ...correction,
    verifiedAt,
    approvedBy: adminUser.id,
  });

  const updated = await knowledgeCorrectionRepository.update(c.env.DB, id, {
    verifiedAt,
    approvedBy: adminUser.id,
    needsReviewAt: null,
    needsReviewReason: null,
  });

  return c.json(
    {
      message: "訂正を再確認済みにしました",
      correction: toCorrectionResponse(updated),
    },
    200,
  );
});

const publishRoute = createRoute({
  method: "post",
  path: "/{id}/publish",
  summary: "未反映の訂正を再発行",
  description: "発行に失敗して未反映のままの訂正を、R2 と検索へ再反映します",
  tags: ["Admin - Corrections"],
  request: {
    params: z.object({ id: z.string().min(1) }),
  },
  responses: {
    200: {
      description: "再発行成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            correction: CorrectionSchema,
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
    500: errorResponse(500),
  },
});

correctionsAdminRoutes.openapi(publishRoute, async (c) => {
  const { id } = c.req.valid("param");

  const correction = await knowledgeCorrectionRepository.findById(c.env.DB, id);
  if (!correction || correction.status === "retired") {
    throw new HTTPException(404, { message: "訂正が見つかりません" });
  }

  await publishOrFail(c.env, correction);

  const updated = await knowledgeCorrectionRepository.update(c.env.DB, id, {
    status: "published",
  });

  return c.json(
    {
      message: "訂正を再発行しました",
      correction: toCorrectionResponse(updated),
    },
    200,
  );
});

const republishRoute = createRoute({
  method: "post",
  path: "/republish",
  summary: "公開中の訂正を一括再発行",
  description: "R2 再構築時などに、公開中の全訂正を R2 と検索へ再反映します",
  tags: ["Admin - Corrections"],
  responses: {
    200: {
      description: "再発行結果",
      content: {
        "application/json": {
          schema: z.object({ message: z.string(), published: z.number() }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    500: errorResponse(500),
  },
});

correctionsAdminRoutes.openapi(republishRoute, async (c) => {
  const corrections = await knowledgeCorrectionRepository.listPublished(
    c.env.DB,
  );

  for (const correction of corrections) {
    await publishOrFail(c.env, correction);
  }

  return c.json(
    {
      message: `${corrections.length}件の訂正を再発行しました`,
      published: corrections.length,
    },
    200,
  );
});

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { logger } from "~/lib/logger";
import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireAdminUser } from "~/lib/principal";
import { requireAuth } from "~/middleware/auth";
import { requireRole } from "~/middleware/require-role";
import { questionnaireRepository } from "~/repository/questionnaire-repository";
import {
  createQuestionnaireSchema,
  questionnaireResponseSchema,
  questionnaireResultsSchema,
  questionnaireStatusSchema,
  updateQuestionnaireSchema,
} from "~/schemas/questionnaire-schema";
import {
  createQuestionnaire,
  getQuestionnaireWithQuestions,
  updateQuestionnaire,
} from "~/services/questionnaire";
import { sendQuestionnaire } from "~/services/questionnaire-delivery";
import { getQuestionnaireResults } from "~/services/questionnaire-response";

export const questionnaireAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

questionnaireAdminRoutes.use("*", requireAuth);
questionnaireAdminRoutes.use("*", requireRole("staff"));

// --- 一覧取得 ---

const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "アンケート一覧を取得",
  description: "アンケートの一覧を取得します",
  tags: ["Admin - Questionnaire"],
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).optional().default(30),
      cursor: z.string().optional(),
      status: questionnaireStatusSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: z.object({
            questionnaires: z.array(questionnaireResponseSchema),
            total: z.number(),
            nextCursor: z.string().nullable(),
            hasMore: z.boolean(),
          }),
        },
      },
    },
    401: errorResponse(401),
  },
});

questionnaireAdminRoutes.openapi(listRoute, async (c) => {
  const { limit, cursor, status } = c.req.valid("query");

  const result = await questionnaireRepository.findAll(c.env.DB, {
    limit,
    cursor: cursor ?? undefined,
    status: status ?? undefined,
  });
  const total = await questionnaireRepository.count(c.env.DB);

  // 各アンケートに設問を付与
  const withQuestions = (
    await Promise.all(
      result.questionnaires.map((q) =>
        getQuestionnaireWithQuestions(c.env.DB, q.id),
      ),
    )
  ).filter((q) => q !== null);

  return c.json(
    {
      questionnaires: withQuestions,
      total,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    },
    200,
  );
});

// --- 作成 ---

const createRoute_ = createRoute({
  method: "post",
  path: "/",
  summary: "アンケートを作成",
  description: "アンケートを作成します",
  tags: ["Admin - Questionnaire"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createQuestionnaireSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "作成成功",
      content: {
        "application/json": {
          schema: questionnaireResponseSchema,
        },
      },
    },
    401: errorResponse(401),
  },
});

questionnaireAdminRoutes.openapi(createRoute_, async (c) => {
  const body = c.req.valid("json");
  const adminUser = requireAdminUser(c.get("principal"));

  try {
    const questionnaire = await createQuestionnaire(c.env, {
      ...body,
      createdBy: adminUser.id,
    });

    if (!questionnaire) {
      throw new HTTPException(500, {
        message: "アンケートの作成に失敗しました",
      });
    }

    return c.json(questionnaire, 201);
  } catch (error) {
    logger.error("[Questionnaire] Failed to create questionnaire", error);
    throw new HTTPException(500, {
      message: "アンケートの作成に失敗しました",
    });
  }
});

// --- 詳細取得 ---

const getDetailRoute = createRoute({
  method: "get",
  path: "/{id}",
  summary: "アンケート詳細を取得",
  description: "アンケートの詳細情報を取得します",
  tags: ["Admin - Questionnaire"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: questionnaireResponseSchema,
        },
      },
    },
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

questionnaireAdminRoutes.openapi(getDetailRoute, async (c) => {
  const { id } = c.req.valid("param");
  const questionnaire = await getQuestionnaireWithQuestions(c.env.DB, id);

  if (!questionnaire) {
    throw new HTTPException(404, {
      message: "アンケートが見つかりません",
    });
  }

  return c.json(questionnaire, 200);
});

// --- 更新 ---

const updateRoute = createRoute({
  method: "put",
  path: "/{id}",
  summary: "アンケートを更新",
  description: "アンケートを更新します（draftのみ）",
  tags: ["Admin - Questionnaire"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        "application/json": {
          schema: updateQuestionnaireSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "更新成功",
      content: {
        "application/json": {
          schema: questionnaireResponseSchema,
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

questionnaireAdminRoutes.openapi(updateRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const existing = await questionnaireRepository.findById(c.env.DB, id);
  if (!existing) {
    throw new HTTPException(404, {
      message: "アンケートが見つかりません",
    });
  }
  if (existing.status !== "draft") {
    throw new HTTPException(400, {
      message: "下書き状態のアンケートのみ更新できます",
    });
  }

  const updated = await updateQuestionnaire(c.env.DB, id, body);

  if (!updated) {
    throw new HTTPException(500, { message: "アンケートの更新に失敗しました" });
  }

  return c.json(updated, 200);
});

// --- 削除 ---

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  summary: "アンケートを削除",
  description: "アンケートを削除します（draftのみ）",
  tags: ["Admin - Questionnaire"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "削除成功",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

questionnaireAdminRoutes.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");

  const existing = await questionnaireRepository.findById(c.env.DB, id);
  if (!existing) {
    throw new HTTPException(404, {
      message: "アンケートが見つかりません",
    });
  }
  if (existing.status !== "draft" && existing.status !== "scheduled") {
    throw new HTTPException(400, {
      message: "下書きまたは予約済みのアンケートのみ削除できます",
    });
  }

  await questionnaireRepository.delete(c.env.DB, id);
  return c.json({ message: "アンケートを削除しました" }, 200);
});

// --- LINE配信 ---

const sendRoute = createRoute({
  method: "post",
  path: "/{id}/send",
  summary: "アンケートをLINEに配信",
  description: "アンケートをLINE全ユーザーに配信します",
  tags: ["Admin - Questionnaire"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "配信成功",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    404: errorResponse(404),
    500: errorResponse(500),
  },
});

questionnaireAdminRoutes.openapi(sendRoute, async (c) => {
  const { id } = c.req.valid("param");

  const result = await sendQuestionnaire(c.env, id);
  if (!result.success) {
    const status = result.error?.includes("見つかりません") ? 404 : 400;
    throw new HTTPException(status, {
      message: result.error ?? "配信に失敗しました",
    });
  }

  return c.json({ message: "アンケートを配信しました" }, 200);
});

// --- 結果取得 ---

const resultsRoute = createRoute({
  method: "get",
  path: "/{id}/results",
  summary: "アンケート結果を取得",
  description: "アンケートの回答結果を集計して取得します",
  tags: ["Admin - Questionnaire"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: questionnaireResultsSchema,
        },
      },
    },
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

questionnaireAdminRoutes.openapi(resultsRoute, async (c) => {
  const { id } = c.req.valid("param");

  const results = await getQuestionnaireResults(c.env.DB, id);
  if (!results) {
    throw new HTTPException(404, {
      message: "アンケートが見つかりません",
    });
  }

  return c.json(results, 200);
});

// --- 締切 ---

const closeRoute = createRoute({
  method: "post",
  path: "/{id}/close",
  summary: "アンケートを締切",
  description: "アンケートの回答受付を締め切ります",
  tags: ["Admin - Questionnaire"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "締切成功",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

questionnaireAdminRoutes.openapi(closeRoute, async (c) => {
  const { id } = c.req.valid("param");

  const existing = await questionnaireRepository.findById(c.env.DB, id);
  if (!existing) {
    throw new HTTPException(404, {
      message: "アンケートが見つかりません",
    });
  }
  if (existing.status !== "sent") {
    throw new HTTPException(400, {
      message: "配信済みのアンケートのみ締切できます",
    });
  }

  await questionnaireRepository.update(c.env.DB, id, {
    status: "closed",
    closedAt: new Date().toISOString(),
  });

  return c.json({ message: "アンケートを締め切りました" }, 200);
});

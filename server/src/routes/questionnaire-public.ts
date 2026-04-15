import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import { questionnaireRepository } from "~/repository/questionnaire-repository";
import { getQuestionnaireResults } from "~/services/questionnaire-response";

export const questionnairePublicRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const pollResultSchema = z.object({
  questionnaireId: z.string(),
  title: z.string(),
  totalSubmissions: z.number(),
  completedSubmissions: z.number(),
  questionResults: z.array(
    z.object({
      questionId: z.string(),
      questionText: z.string(),
      questionType: z.enum(["single_choice", "multiple_choice"]),
      totalResponses: z.number(),
      choiceResults: z.array(
        z.object({
          choice: z.string(),
          count: z.number(),
          percentage: z.number(),
        }),
      ),
    }),
  ),
});

const pollRoute = createRoute({
  method: "get",
  path: "/{id}/poll",
  summary: "アンケート投票結果を公開取得",
  description:
    "選択式設問の集計結果を認証不要で取得します。sent/closed のアンケートのみ対象。",
  tags: ["Questionnaire"],
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
          schema: pollResultSchema,
        },
      },
    },
    404: errorResponse(404),
  },
});

questionnairePublicRoutes.openapi(pollRoute, async (c) => {
  const { id } = c.req.valid("param");

  const questionnaire = await questionnaireRepository.findById(c.env.DB, id);
  if (!questionnaire) {
    throw new HTTPException(404, {
      message: "アンケートが見つかりません",
    });
  }

  if (questionnaire.status !== "sent" && questionnaire.status !== "closed") {
    throw new HTTPException(404, {
      message: "アンケートが見つかりません",
    });
  }

  const results = await getQuestionnaireResults(c.env.DB, id);
  if (!results) {
    throw new HTTPException(404, {
      message: "アンケートが見つかりません",
    });
  }

  const choiceResults = results.questionResults.filter(
    (
      qr,
    ): qr is typeof qr & {
      choiceResults: { choice: string; count: number; percentage: number }[];
    } =>
      (qr.questionType === "single_choice" ||
        qr.questionType === "multiple_choice") &&
      "choiceResults" in qr,
  );

  return c.json(
    {
      questionnaireId: results.questionnaireId,
      title: results.title,
      totalSubmissions: results.totalSubmissions,
      completedSubmissions: results.completedSubmissions,
      questionResults: choiceResults.map((qr) => ({
        questionId: qr.questionId,
        questionText: qr.questionText,
        questionType: qr.questionType as "single_choice" | "multiple_choice",
        totalResponses: qr.totalResponses,
        choiceResults: qr.choiceResults,
      })),
    },
    200,
  );
});

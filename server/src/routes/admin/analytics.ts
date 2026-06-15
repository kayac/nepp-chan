import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import {
  DAY_MS,
  jstDateToUtc,
  startOfJstDay,
  startOfJstWeek,
  WEEK_MS,
} from "~/lib/date";
import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireRole } from "~/middleware/require-role";
import { weeklyReportRepository } from "~/repository/weekly-report-repository";
import {
  conversationAnalyticsQuerySchema,
  conversationAnalyticsResponseSchema,
  ontologyResponseSchema,
  personaAnalyticsQuerySchema,
  personaAnalyticsResponseSchema,
  usageAnalyticsQuerySchema,
  usageAnalyticsResponseSchema,
  weeklyReportDetailResponseSchema,
  weeklyReportsQuerySchema,
  weeklyReportsResponseSchema,
  weeklyStatsSchema,
} from "~/schemas/analytics-schema";
import {
  getConversationStats,
  getPersonaAnalytics,
  getWeeklyUsage,
} from "~/services/analytics/aggregate";
import { backfillPersonaEntities } from "~/services/analytics/backfill-persona-entities";
import { getOntology } from "~/services/analytics/ontology";

export const analyticsAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

analyticsAdminRoutes.use("*", requireRole("super_admin"));

const personaRoute = createRoute({
  method: "get",
  path: "/persona",
  tags: ["Admin - Analytics"],
  summary: "ペルソナ分析（年代×ネガポジ・トピック割合・ユーザー層）",
  request: { query: personaAnalyticsQuerySchema },
  responses: {
    200: {
      description: "ペルソナ集計結果",
      content: {
        "application/json": { schema: personaAnalyticsResponseSchema },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

analyticsAdminRoutes.openapi(personaRoute, async (c) => {
  const { from, to } = c.req.valid("query");

  const result = await getPersonaAnalytics(c.env.DB, {
    from: from ? jstDateToUtc(from).toISOString() : undefined,
    // to はその日を含むため翌日 0:00 JST 未満で絞る
    to: to
      ? new Date(jstDateToUtc(to).getTime() + DAY_MS).toISOString()
      : undefined,
  });

  return c.json(result, 200);
});

const ontologyRoute = createRoute({
  method: "get",
  path: "/ontology",
  tags: ["Admin - Analytics"],
  summary: "村の声グラフ（セグメント×トピックの関係グラフ）",
  request: { query: personaAnalyticsQuerySchema },
  responses: {
    200: {
      description: "村の声グラフのノード・リンク",
      content: {
        "application/json": { schema: ontologyResponseSchema },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

analyticsAdminRoutes.openapi(ontologyRoute, async (c) => {
  const { from, to } = c.req.valid("query");

  const result = await getOntology(c.env.DB, {
    from: from ? jstDateToUtc(from).toISOString() : undefined,
    to: to
      ? new Date(jstDateToUtc(to).getTime() + DAY_MS).toISOString()
      : undefined,
  });

  return c.json(result, 200);
});

const ontologyBackfillRoute = createRoute({
  method: "post",
  path: "/ontology/backfill",
  tags: ["Admin - Analytics"],
  summary: "既存 persona に entities を差し込む（チャンク・冪等）",
  responses: {
    200: {
      description: "処理件数と残数",
      content: {
        "application/json": {
          schema: z.object({
            processed: z.number(),
            updated: z.number(),
            remaining: z.number(),
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

analyticsAdminRoutes.openapi(ontologyBackfillRoute, async (c) => {
  const result = await backfillPersonaEntities(c.env);

  return c.json(result, 200);
});

const conversationsRoute = createRoute({
  method: "get",
  path: "/conversations",
  tags: ["Admin - Analytics"],
  summary: "会話量（日別・時間帯分布・プラットフォーム別）",
  description:
    "raw 会話の保持期間は 30 日のため、それ以前の状況は週次レポートを参照する。",
  request: { query: conversationAnalyticsQuerySchema },
  responses: {
    200: {
      description: "会話量の集計結果（時刻は JST）",
      content: {
        "application/json": { schema: conversationAnalyticsResponseSchema },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

analyticsAdminRoutes.openapi(conversationsRoute, async (c) => {
  const { days } = c.req.valid("query");
  const now = new Date();

  const stats = await getConversationStats(c.env.DB, {
    from: startOfJstDay(
      new Date(now.getTime() - (days - 1) * DAY_MS),
    ).toISOString(),
    to: now.toISOString(),
  });

  return c.json(stats, 200);
});

const usageRoute = createRoute({
  method: "get",
  path: "/usage",
  tags: ["Admin - Analytics"],
  summary: "週×モデル別のトークン使用量とコスト",
  request: { query: usageAnalyticsQuerySchema },
  responses: {
    200: {
      description: "週次トークン使用量（週初めは JST 月曜）",
      content: {
        "application/json": { schema: usageAnalyticsResponseSchema },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

analyticsAdminRoutes.openapi(usageRoute, async (c) => {
  const { weeks } = c.req.valid("query");
  const currentWeekStart = startOfJstWeek(new Date());

  const weekly = await getWeeklyUsage(c.env.DB, {
    from: new Date(
      currentWeekStart.getTime() - (weeks - 1) * WEEK_MS,
    ).toISOString(),
  });

  return c.json({ weekly }, 200);
});

const reportsRoute = createRoute({
  method: "get",
  path: "/reports",
  tags: ["Admin - Analytics"],
  summary: "週次レポート一覧",
  request: { query: weeklyReportsQuerySchema },
  responses: {
    200: {
      description: "週次レポート一覧（period_start 降順）",
      content: {
        "application/json": { schema: weeklyReportsResponseSchema },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

analyticsAdminRoutes.openapi(reportsRoute, async (c) => {
  const { limit } = c.req.valid("query");
  const reports = await weeklyReportRepository.list(c.env.DB, { limit });

  return c.json(
    {
      reports: reports.map((report) => ({
        id: report.id,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        summary: report.summary,
        createdAt: report.createdAt,
      })),
    },
    200,
  );
});

const reportDetailRoute = createRoute({
  method: "get",
  path: "/reports/{id}",
  tags: ["Admin - Analytics"],
  summary: "週次レポート詳細",
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: {
    200: {
      description: "週次レポート詳細（stats 含む）",
      content: {
        "application/json": { schema: weeklyReportDetailResponseSchema },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
  },
});

analyticsAdminRoutes.openapi(reportDetailRoute, async (c) => {
  const { id } = c.req.valid("param");
  const report = await weeklyReportRepository.findById(c.env.DB, id);

  if (!report) {
    throw new HTTPException(404, { message: "レポートが見つかりません" });
  }

  return c.json(
    {
      report: {
        id: report.id,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        summary: report.summary,
        createdAt: report.createdAt,
        stats: weeklyStatsSchema.parse(JSON.parse(report.stats)),
      },
    },
    200,
  );
});

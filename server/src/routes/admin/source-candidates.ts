import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireAdminUser } from "~/lib/principal";
import { requireRole } from "~/middleware/require-role";
import {
  SOURCE_CANDIDATE_STATUSES,
  type SourceCandidate,
  type SourceCandidateStatus,
  sourceCandidateRepository,
} from "~/repository/source-candidate-repository";

export const sourceCandidatesAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

sourceCandidatesAdminRoutes.use("*", requireRole("admin"));

const CandidateSchema = z.object({
  id: z.string(),
  url: z.string(),
  status: z.enum(SOURCE_CANDIDATE_STATUSES),
  occurrenceCount: z.number(),
  relatedAnswerRunId: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  lastSeenAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

const toCandidateResponse = (candidate: SourceCandidate) => ({
  id: candidate.id,
  url: candidate.url,
  status: candidate.status as SourceCandidateStatus,
  occurrenceCount: candidate.occurrenceCount,
  relatedAnswerRunId: candidate.relatedAnswerRunId,
  decidedBy: candidate.decidedBy,
  decidedAt: candidate.decidedAt,
  lastSeenAt: candidate.lastSeenAt,
  createdAt: candidate.createdAt,
  updatedAt: candidate.updatedAt,
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "情報源候補の一覧を取得",
  description: "Web 検索の回答で参照された、未収集の公式ページ候補を一覧します",
  tags: ["Admin - Source Candidates"],
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: z.object({ candidates: z.array(CandidateSchema) }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

sourceCandidatesAdminRoutes.openapi(listRoute, async (c) => {
  const candidates = await sourceCandidateRepository.list(c.env.DB);
  return c.json({ candidates: candidates.map(toCandidateResponse) }, 200);
});

const updateStatusRoute = createRoute({
  method: "patch",
  path: "/{id}/status",
  summary: "情報源候補の承認状態を変更",
  description:
    "承認・却下の判断を記録します。reset で未判断に戻します。承認済み候補の収集は通常の取り込み手順で行います",
  tags: ["Admin - Source Candidates"],
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            action: z.enum(["approve", "reject", "reset"]),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "変更成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            candidate: CandidateSchema,
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
  },
});

sourceCandidatesAdminRoutes.openapi(updateStatusRoute, async (c) => {
  const { id } = c.req.valid("param");
  const { action } = c.req.valid("json");
  const adminUser = requireAdminUser(c.get("principal"));

  const candidate = await sourceCandidateRepository.findById(c.env.DB, id);
  if (!candidate) {
    throw new HTTPException(404, { message: "情報源候補が見つかりません" });
  }

  const status =
    action === "approve"
      ? "approved"
      : action === "reject"
        ? "rejected"
        : "pending";

  const updated = await sourceCandidateRepository.updateStatus(c.env.DB, id, {
    status,
    decidedBy: action === "reset" ? null : adminUser.id,
  });

  const messages = {
    approve:
      "承認しました。収集対象への追加は通常の取り込み手順で行ってください",
    reject: "却下しました",
    reset: "未判断に戻しました",
  } as const;

  return c.json(
    {
      message: messages[action],
      candidate: toCandidateResponse(updated),
    },
    200,
  );
});

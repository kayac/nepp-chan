import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireAdminUser } from "~/lib/principal";
import {
  APPROVAL_STATUSES,
  type ApprovalStatus,
  type KnowledgeSource,
  knowledgeSourceRepository,
} from "~/repository/knowledge-source-repository";
import {
  indexKnowledgeSource,
  removeKnowledgeSource,
} from "~/services/knowledge/indexing";
import { buildSourceRecord } from "~/services/knowledge/source-meta";
import { listMarkdownObjects } from "~/services/knowledge/sync";
import { requireApiKey, validateFileKey } from "./schemas";

export const knowledgeSourcesRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

const SourceSchema = z.object({
  sourcePath: z.string(),
  canonicalUrl: z.string().nullable(),
  sourceType: z.string().nullable(),
  sourceAuthority: z.number().nullable(),
  approvalStatus: z.enum(APPROVAL_STATUSES),
  chunkCount: z.number(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  disabledAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  indexedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

const toSourceResponse = (row: KnowledgeSource) => ({
  sourcePath: row.sourcePath,
  canonicalUrl: row.canonicalUrl,
  sourceType: row.sourceType,
  sourceAuthority: row.sourceAuthority,
  approvalStatus: row.approvalStatus as ApprovalStatus,
  chunkCount: row.chunkCount,
  approvedBy: row.approvedBy,
  approvedAt: row.approvedAt,
  disabledAt: row.disabledAt,
  verifiedAt: row.verifiedAt,
  indexedAt: row.indexedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const listSourcesRoute = createRoute({
  method: "get",
  path: "/sources",
  summary: "情報源一覧を取得",
  description: "ナレッジ情報源の承認状態を一覧します",
  tags: ["Admin - Knowledge"],
  responses: {
    200: {
      description: "情報源一覧",
      content: {
        "application/json": {
          schema: z.object({ sources: z.array(SourceSchema) }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

knowledgeSourcesRoutes.openapi(listSourcesRoute, async (c) => {
  const rows = await knowledgeSourceRepository.list(c.env.DB);
  return c.json({ sources: rows.map(toSourceResponse) }, 200);
});

const backfillRoute = createRoute({
  method: "post",
  path: "/sources/backfill",
  summary: "既存ナレッジを承認済み情報源として登録",
  description:
    "R2 の Markdown のうち情報源未登録のものを approved で一括登録します",
  tags: ["Admin - Knowledge"],
  responses: {
    200: {
      description: "登録結果",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            registered: z.number(),
            skipped: z.number(),
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

const BACKFILL_BATCH_SIZE = 20;

knowledgeSourcesRoutes.openapi(backfillRoute, async (c) => {
  const adminUser = requireAdminUser(c.get("principal"));
  const { mdFiles } = await listMarkdownObjects(c.env.KNOWLEDGE_BUCKET);
  const registeredPaths = new Set(
    (await knowledgeSourceRepository.list(c.env.DB)).map((r) => r.sourcePath),
  );
  const targets = mdFiles.filter((obj) => !registeredPaths.has(obj.key));
  const now = new Date().toISOString();

  let registered = 0;
  for (let i = 0; i < targets.length; i += BACKFILL_BATCH_SIZE) {
    const batch = targets.slice(i, i + BACKFILL_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (obj) => {
        const file = await c.env.KNOWLEDGE_BUCKET.get(obj.key);
        if (!file) return false;
        await knowledgeSourceRepository.insert(c.env.DB, {
          ...(await buildSourceRecord(obj.key, await file.text())),
          r2Etag: obj.etag,
          approvalStatus: "approved",
          approvedBy: adminUser.id,
          approvedAt: now,
          createdAt: now,
        });
        return true;
      }),
    );
    registered += results.filter(Boolean).length;
  }

  return c.json(
    {
      message: `${registered}件の情報源を登録しました`,
      registered,
      skipped: mdFiles.length - registered,
    },
    200,
  );
});

const updateStatusRoute = createRoute({
  method: "patch",
  path: "/sources/status",
  summary: "情報源の承認状態を変更",
  description:
    "approve は再インデックス、reject / disable は検索対象からの削除まで行います",
  tags: ["Admin - Knowledge"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            sourcePath: z.string().min(1),
            action: z.enum(["approve", "reject", "disable"]),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "変更結果",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            source: SourceSchema,
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

knowledgeSourcesRoutes.openapi(updateStatusRoute, async (c) => {
  const { sourcePath, action } = c.req.valid("json");
  validateFileKey(sourcePath);
  const adminUser = requireAdminUser(c.get("principal"));

  const row = await knowledgeSourceRepository.findByPath(c.env.DB, sourcePath);
  if (!row) {
    throw new HTTPException(404, { message: "情報源が見つかりません" });
  }

  const now = new Date().toISOString();

  if (action === "approve") {
    const file = await c.env.KNOWLEDGE_BUCKET.get(sourcePath);
    if (!file) {
      throw new HTTPException(404, {
        message: "R2 にファイルが見つかりません",
      });
    }
    const apiKey = requireApiKey(c.env.GOOGLE_GENERATIVE_AI_API_KEY);

    await knowledgeSourceRepository.update(c.env.DB, sourcePath, {
      approvalStatus: "approved",
      approvedBy: adminUser.id,
      approvedAt: now,
      disabledAt: null,
    });

    const result = await indexKnowledgeSource(sourcePath, await file.text(), {
      d1: c.env.DB,
      vectorize: c.env.VECTORIZE,
      apiKey,
    });
    if (result.error) {
      throw new HTTPException(500, {
        message: `インデックスに失敗しました: ${result.error}`,
      });
    }
  } else {
    await knowledgeSourceRepository.update(c.env.DB, sourcePath, {
      approvalStatus: action === "reject" ? "rejected" : "disabled",
      ...(action === "disable" && { disabledAt: now }),
    });
    await removeKnowledgeSource(sourcePath, {
      d1: c.env.DB,
      vectorize: c.env.VECTORIZE,
    });
  }

  const updated = await knowledgeSourceRepository.findByPath(
    c.env.DB,
    sourcePath,
  );
  if (!updated) {
    throw new HTTPException(500, { message: "情報源の更新に失敗しました" });
  }

  return c.json(
    {
      message: `${sourcePath} を ${updated.approvalStatus} にしました`,
      source: toSourceResponse(updated),
    },
    200,
  );
});

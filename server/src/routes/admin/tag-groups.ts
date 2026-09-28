import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireRole } from "~/middleware/require-role";
import { personaTagGroupRepository } from "~/repository/persona-tag-group-repository";
import {
  assignTagGroupsResponseSchema,
  createTagGroupBodySchema,
  setTagAliasBodySchema,
  tagGroupSchema,
  tagGroupsResponseSchema,
} from "~/schemas/tag-group-schema";
import {
  assignUnmappedTags,
  createTagGroup,
  getTagGroupOverview,
} from "~/services/analytics/tag-group-assign";
import { normalizeTag } from "~/services/analytics/tag-groups";

export const tagGroupAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

tagGroupAdminRoutes.use("*", requireRole("staff"));

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Admin - Tag Groups"],
  summary: "タググループと所属タグ、未分類タグの一覧",
  responses: {
    200: {
      description: "グループ一覧",
      content: { "application/json": { schema: tagGroupsResponseSchema } },
    },
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

tagGroupAdminRoutes.openapi(listRoute, async (c) => {
  const overview = await getTagGroupOverview(c.env.DB);
  return c.json(overview, 200);
});

const createGroupRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Admin - Tag Groups"],
  summary: "グループを追加する",
  request: {
    body: {
      content: { "application/json": { schema: createTagGroupBodySchema } },
    },
  },
  responses: {
    201: {
      description: "追加したグループ",
      content: { "application/json": { schema: tagGroupSchema } },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

tagGroupAdminRoutes.openapi(createGroupRoute, async (c) => {
  const group = await createTagGroup(c.env.DB, c.req.valid("json"));
  return c.json(
    {
      id: group.id,
      name: group.name,
      kind: group.kind as "attribute" | "topic" | "exclude",
      axis: group.axis,
      sortOrder: group.sortOrder,
    },
    201,
  );
});

const setAliasRoute = createRoute({
  method: "put",
  path: "/aliases/{tag}",
  tags: ["Admin - Tag Groups"],
  summary: "タグの割り当て先を変更する",
  request: {
    params: z.object({ tag: z.string().min(1) }),
    body: {
      content: { "application/json": { schema: setTagAliasBodySchema } },
    },
  },
  responses: {
    200: {
      description: "更新後の割り当て",
      content: {
        "application/json": {
          schema: z.object({ tag: z.string(), groupId: z.string().nullable() }),
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
  },
});

tagGroupAdminRoutes.openapi(setAliasRoute, async (c) => {
  const tag = normalizeTag(c.req.valid("param").tag);
  const { groupId } = c.req.valid("json");
  if (groupId !== null) {
    const group = await personaTagGroupRepository.findGroup(c.env.DB, groupId);
    if (!group) {
      throw new HTTPException(404, { message: "グループが見つかりません" });
    }
  }
  await personaTagGroupRepository.setAlias(c.env.DB, {
    tag,
    groupId,
    assignedBy: "human",
  });
  return c.json({ tag, groupId }, 200);
});

const assignRoute = createRoute({
  method: "post",
  path: "/assign",
  tags: ["Admin - Tag Groups"],
  summary: "未登録タグを 1 バッチ分 LLM でグループに振り分ける",
  responses: {
    200: {
      description: "振り分け件数と残り件数",
      content: {
        "application/json": { schema: assignTagGroupsResponseSchema },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

tagGroupAdminRoutes.openapi(assignRoute, async (c) => {
  const result = await assignUnmappedTags(c.env);
  return c.json(result, 200);
});

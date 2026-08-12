import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireRole } from "~/middleware/require-role";
import { widgetSiteRepository } from "~/repository/widget-site-repository";
import {
  widgetSiteInputSchema,
  widgetSiteSchema,
} from "~/schemas/widget-site-schema";

export const widgetSiteAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

widgetSiteAdminRoutes.use("*", requireRole("super_admin"));

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Admin - Widget Sites"],
  summary: "ウィジェット設置サイト一覧",
  description:
    "ウィジェットを設置できるサイトと、そのサイト向けの指示の一覧を返します。スーパー管理者のみ実行できます。",
  responses: {
    200: {
      description: "一覧取得成功",
      content: {
        "application/json": {
          schema: z.object({ sites: z.array(widgetSiteSchema) }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

widgetSiteAdminRoutes.openapi(listRoute, async (c) => {
  const sites = await widgetSiteRepository.list(c.env.DB);
  return c.json({ sites }, 200);
});

const createSiteRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Admin - Widget Sites"],
  summary: "ウィジェット設置サイト登録",
  description:
    "ウィジェットの設置を許可するサイトを登録します。スーパー管理者のみ実行できます。",
  request: {
    body: {
      content: { "application/json": { schema: widgetSiteInputSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "登録成功",
      content: { "application/json": { schema: widgetSiteSchema } },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    403: errorResponse(403),
    409: errorResponse(409),
  },
});

widgetSiteAdminRoutes.openapi(createSiteRoute, async (c) => {
  const { host, instructions } = c.req.valid("json");

  if (await widgetSiteRepository.findByHost(c.env.DB, host)) {
    throw new HTTPException(409, {
      message: "このドメインはすでに登録されています",
    });
  }

  const site = await widgetSiteRepository.create(c.env.DB, {
    id: crypto.randomUUID(),
    host,
    instructions,
    createdAt: new Date().toISOString(),
  });

  return c.json(site, 201);
});

const updateSiteRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Admin - Widget Sites"],
  summary: "ウィジェット設置サイト更新",
  description:
    "設置サイトのドメインと指示を更新します。スーパー管理者のみ実行できます。",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: widgetSiteInputSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "更新成功",
      content: { "application/json": { schema: widgetSiteSchema } },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
    409: errorResponse(409),
  },
});

widgetSiteAdminRoutes.openapi(updateSiteRoute, async (c) => {
  const { id } = c.req.valid("param");
  const { host, instructions } = c.req.valid("json");

  if (!(await widgetSiteRepository.findById(c.env.DB, id))) {
    throw new HTTPException(404, { message: "設置サイトが見つかりません" });
  }

  const duplicated = await widgetSiteRepository.findByHost(c.env.DB, host);
  if (duplicated && duplicated.id !== id) {
    throw new HTTPException(409, {
      message: "このドメインはすでに登録されています",
    });
  }

  const updated = await widgetSiteRepository.update(c.env.DB, id, {
    host,
    instructions,
  });

  return c.json(updated, 200);
});

const deleteSiteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Admin - Widget Sites"],
  summary: "ウィジェット設置サイト削除",
  description: "設置サイトの登録を削除します。スーパー管理者のみ実行できます。",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "削除成功",
      content: {
        "application/json": { schema: z.object({ message: z.string() }) },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
  },
});

widgetSiteAdminRoutes.openapi(deleteSiteRoute, async (c) => {
  const { id } = c.req.valid("param");

  if (!(await widgetSiteRepository.findById(c.env.DB, id))) {
    throw new HTTPException(404, { message: "設置サイトが見つかりません" });
  }

  await widgetSiteRepository.delete(c.env.DB, id);

  return c.json({ message: "設置サイトを削除しました" }, 200);
});

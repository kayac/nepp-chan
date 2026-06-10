import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireAdminUser } from "~/lib/principal";
import { requireRole } from "~/middleware/require-role";
import { adminUserRepository } from "~/repository/admin-user-repository";
import { deleteAdminUser } from "~/services/auth/admin-user";

export const userAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

userAdminRoutes.use("*", requireRole("super_admin"));

const deleteUserRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Admin - Users"],
  summary: "管理ユーザー削除",
  description:
    "管理ユーザーをセッション・招待ごと削除します。スーパー管理者のみ実行できます。",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "ユーザー削除成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
  },
});

userAdminRoutes.openapi(deleteUserRoute, async (c) => {
  const { id } = c.req.valid("param");
  const adminUser = requireAdminUser(c.get("principal"));

  if (id === adminUser.id) {
    throw new HTTPException(400, { message: "自分自身は削除できません" });
  }

  const user = await adminUserRepository.findById(c.env.DB, id);
  if (!user) {
    throw new HTTPException(404, { message: "ユーザーが見つかりません" });
  }

  await deleteAdminUser(c.env.DB, user);

  return c.json({ message: "ユーザーを削除しました" }, 200);
});

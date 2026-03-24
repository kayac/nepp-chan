import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { errorResponse } from "~/lib/openapi-errors";
import { type AuthVariables, requireAuth } from "~/middleware/auth";
import { requireRole } from "~/middleware/require-role";
import { adminInvitationRepository } from "~/repository/admin-invitation-repository";
import { adminRoleSchema } from "~/schemas/auth-schema";
import { createInvitation } from "~/services/auth/invitation";

export const invitationRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: AuthVariables;
}>();

invitationRoutes.use("*", requireAuth);
invitationRoutes.use("*", requireRole("admin"));

const listInvitationsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Admin - Invitations"],
  summary: "招待一覧取得",
  responses: {
    200: {
      description: "招待一覧",
      content: {
        "application/json": {
          schema: z.object({
            invitations: z.array(
              z.object({
                id: z.string(),
                username: z.string(),
                role: adminRoleSchema,
                invitedBy: z.string(),
                expiresAt: z.string(),
                usedAt: z.string().nullable(),
                createdAt: z.string(),
              }),
            ),
          }),
        },
      },
    },
    401: errorResponse(401),
  },
});

invitationRoutes.openapi(listInvitationsRoute, async (c) => {
  const invitations = await adminInvitationRepository.list(c.env.DB);

  return c.json(
    {
      invitations: invitations.map((inv) => ({
        id: inv.id,
        username: inv.username,
        role: adminRoleSchema.parse(inv.role),
        invitedBy: inv.invitedBy,
        expiresAt: inv.expiresAt,
        usedAt: inv.usedAt,
        createdAt: inv.createdAt,
      })),
    },
    200,
  );
});

const createInvitationRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Admin - Invitations"],
  summary: "新規招待作成",
  description:
    "管理者を招待します。super_admin ロールの招待は super_admin のみ可能です。",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            username: z.string().min(1),
            role: z.enum(["admin", "staff"]).optional().default("staff"),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "招待作成成功",
      content: {
        "application/json": {
          schema: z.object({
            invitation: z.object({
              id: z.string(),
              username: z.string(),
              token: z.string(),
              expiresAt: z.string(),
            }),
          }),
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

invitationRoutes.openapi(createInvitationRoute, async (c) => {
  const { username, role } = c.req.valid("json");
  const adminUser = c.get("adminUser");

  if (role === "admin" && adminUser.role !== "super_admin") {
    throw new HTTPException(403, {
      message: "管理者の招待はスーパー管理者のみ可能です",
    });
  }

  try {
    const invitation = await createInvitation(
      c.env.DB,
      username,
      adminUser.id,
      role,
      1,
    );

    return c.json(
      {
        invitation: {
          id: invitation.id,
          username: invitation.username,
          token: invitation.token,
          expiresAt: invitation.expiresAt.toISOString(),
        },
      },
      200,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "エラーが発生しました";
    throw new HTTPException(400, { message });
  }
});

const deleteInvitationRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Admin - Invitations"],
  summary: "招待取り消し",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "招待削除成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

invitationRoutes.openapi(deleteInvitationRoute, async (c) => {
  const { id } = c.req.valid("param");

  const invitation = await adminInvitationRepository.findById(c.env.DB, id);
  if (!invitation) {
    throw new HTTPException(404, { message: "招待が見つかりません" });
  }

  await adminInvitationRepository.delete(c.env.DB, id);

  return c.json({ message: "招待を削除しました" }, 200);
});

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type SessionVariables, sessionAuth } from "~/middleware/session-auth";
import { adminInvitationRepository } from "~/repository/admin-invitation-repository";
import { createInvitation } from "~/services/auth/webauthn";

export const invitationRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: SessionVariables;
}>();

invitationRoutes.use("*", sessionAuth);

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
                email: z.string(),
                role: z.string(),
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
  },
});

invitationRoutes.openapi(listInvitationsRoute, async (c) => {
  const invitations = await adminInvitationRepository.list(c.env.DB);

  return c.json(
    {
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
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
    "管理者を招待します。super_admin の招待はスクリプト経由でのみ可能です。",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
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
            success: z.boolean(),
            invitation: z.object({
              id: z.string(),
              email: z.string(),
              token: z.string(),
              expiresAt: z.string(),
            }),
          }),
        },
      },
    },
    400: {
      description: "エラー",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

invitationRoutes.openapi(createInvitationRoute, async (c) => {
  const { email } = c.req.valid("json");
  const adminUser = c.get("adminUser");

  try {
    const invitation = await createInvitation(
      c.env.DB,
      email,
      adminUser.id,
      "admin",
      1,
    );

    return c.json(
      {
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          token: invitation.token,
          expiresAt: invitation.expiresAt.toISOString(),
        },
      },
      200,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "エラーが発生しました";
    return c.json({ error: message }, 400);
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
            success: z.boolean(),
          }),
        },
      },
    },
    404: {
      description: "招待が見つかりません",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

invitationRoutes.openapi(deleteInvitationRoute, async (c) => {
  const { id } = c.req.valid("param");

  const invitation = await adminInvitationRepository.findById(c.env.DB, id);
  if (!invitation) {
    return c.json({ error: "招待が見つかりません" }, 404);
  }

  await adminInvitationRepository.delete(c.env.DB, id);

  return c.json({ success: true }, 200);
});

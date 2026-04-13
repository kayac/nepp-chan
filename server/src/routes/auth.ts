import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { getTokenFromHeader } from "~/lib/auth-header";
import { generateId } from "~/lib/crypto";
import { errorResponse } from "~/lib/openapi-errors";
import { hashPassword, verifyPassword } from "~/lib/password";
import type { PrincipalVariables } from "~/lib/principal";
import { adminInvitationRepository } from "~/repository/admin-invitation-repository";
import { adminSessionRepository } from "~/repository/admin-session-repository";
import { adminUserRepository } from "~/repository/admin-user-repository";
import { AdminUserSchema, adminRoleSchema } from "~/schemas/auth-schema";
import { generateAnonymousToken } from "~/services/auth/anonymous-session";

export const authRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

const toUserResponse = (user: {
  id: string;
  username: string;
  name: string | null;
  role: string;
}) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  role: adminRoleSchema.parse(user.role),
});

// --- Register ---

const registerRoute = createRoute({
  method: "post",
  path: "/register",
  tags: ["Auth"],
  summary: "ユーザー登録",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            token: z.string().describe("招待トークン"),
            password: z.string().min(8).describe("パスワード（8文字以上）"),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "登録成功",
      content: {
        "application/json": {
          schema: z.object({
            accessToken: z.string(),
            user: AdminUserSchema,
          }),
        },
      },
    },
    400: errorResponse(400),
  },
});

authRoutes.openapi(registerRoute, async (c) => {
  const { token, password } = c.req.valid("json");

  const invitation = await adminInvitationRepository.findValidByToken(
    c.env.DB,
    token,
  );
  if (!invitation) {
    throw new HTTPException(400, {
      message: "無効または期限切れの招待トークンです",
    });
  }

  const existingUser = await adminUserRepository.findByUsername(
    c.env.DB,
    invitation.username,
  );
  if (existingUser) {
    throw new HTTPException(400, {
      message: "このユーザー名は既に登録されています",
    });
  }

  const passwordHash = await hashPassword(password);
  const userId = generateId();
  const now = new Date().toISOString();

  await adminUserRepository.create(c.env.DB, {
    id: userId,
    username: invitation.username,
    name: null,
    role: invitation.role,
    passwordHash,
    createdAt: now,
  });

  await adminInvitationRepository.markUsed(c.env.DB, invitation.id);

  const user = {
    id: userId,
    username: invitation.username,
    name: null,
    role: invitation.role,
  };
  const accessToken = await adminSessionRepository.create(c.env.DB, userId);

  return c.json({ accessToken, user: toUserResponse(user) }, 200);
});

// --- Login ---

const loginRoute = createRoute({
  method: "post",
  path: "/login",
  tags: ["Auth"],
  summary: "ログイン",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            username: z.string(),
            password: z.string(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "ログイン成功",
      content: {
        "application/json": {
          schema: z.object({
            accessToken: z.string(),
            user: AdminUserSchema,
          }),
        },
      },
    },
    401: errorResponse(401),
  },
});

authRoutes.openapi(loginRoute, async (c) => {
  const { username, password } = c.req.valid("json");

  const user = await adminUserRepository.findByUsername(c.env.DB, username);
  if (!user) {
    throw new HTTPException(401, {
      message: "ユーザー名またはパスワードが正しくありません",
    });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new HTTPException(401, {
      message: "ユーザー名またはパスワードが正しくありません",
    });
  }

  const accessToken = await adminSessionRepository.create(c.env.DB, user.id);

  return c.json({ accessToken, user: toUserResponse(user) }, 200);
});

// --- Me ---

const meRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Auth"],
  summary: "現在のユーザー情報",
  responses: {
    200: {
      description: "ユーザー情報",
      content: {
        "application/json": {
          schema: z.object({
            user: AdminUserSchema.nullable(),
          }),
        },
      },
    },
  },
});

authRoutes.openapi(meRoute, async (c) => {
  const principal = c.get("principal");
  const user = principal?.type === "admin" ? principal.user : undefined;
  return c.json({ user: user ? toUserResponse(user) : null }, 200);
});

// --- Logout ---

const logoutRoute = createRoute({
  method: "post",
  path: "/logout",
  tags: ["Auth"],
  summary: "ログアウト",
  responses: {
    200: {
      description: "ログアウト成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
});

authRoutes.openapi(logoutRoute, async (c) => {
  const token = getTokenFromHeader(c);
  if (token) {
    await adminSessionRepository.deleteByToken(c.env.DB, token);
  }
  return c.json({ message: "ログアウトしました" }, 200);
});

// --- Anonymous Session ---

const anonymousSessionRoute = createRoute({
  method: "post",
  path: "/anonymous-session",
  tags: ["Auth"],
  summary: "匿名セッショントークン取得",
  description:
    "一般ユーザー向けの匿名セッショントークンを発行する。resourceId はサーバーで生成する。",
  responses: {
    200: {
      description: "トークン発行成功",
      content: {
        "application/json": {
          schema: z.object({
            token: z.string(),
            resourceId: z.string(),
          }),
        },
      },
    },
  },
});

authRoutes.openapi(anonymousSessionRoute, async (c) => {
  const resourceId = crypto.randomUUID();
  const token = await generateAnonymousToken(resourceId, c.env.JWT_SECRET);

  return c.json({ token, resourceId }, 200);
});

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  SESSION_COOKIE_NAME,
  type SessionVariables,
} from "~/middleware/session-auth";
import {
  deleteSession,
  getSessionCookieOptions,
  getUserFromSession,
} from "~/services/auth/session";
import {
  generateWebAuthnAuthenticationOptions,
  generateWebAuthnRegistrationOptions,
  verifyWebAuthnAuthentication,
  verifyWebAuthnRegistration,
  type WebAuthnConfig,
} from "~/services/auth/webauthn";

type AuthBindings = CloudflareBindings & {
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_RP_NAME: string;
  WEBAUTHN_ORIGIN: string;
};

const getWebAuthnConfig = (env: AuthBindings): WebAuthnConfig => ({
  rpId: env.WEBAUTHN_RP_ID,
  rpName: env.WEBAUTHN_RP_NAME,
  origin: env.WEBAUTHN_ORIGIN,
});

export const authRoutes = new OpenAPIHono<{
  Bindings: AuthBindings;
  Variables: SessionVariables;
}>();

const registerOptionsRoute = createRoute({
  method: "post",
  path: "/register/options",
  tags: ["Auth"],
  summary: "パスキー登録オプション生成",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            token: z.string().describe("招待トークン"),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "登録オプション",
      content: {
        "application/json": {
          schema: z.object({
            options: z.any(),
            challengeId: z.string(),
            email: z.string(),
            invitationId: z.string(),
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

authRoutes.openapi(registerOptionsRoute, async (c) => {
  const { token } = c.req.valid("json");
  const config = getWebAuthnConfig(c.env);

  try {
    const result = await generateWebAuthnRegistrationOptions(
      c.env.DB,
      config,
      token,
    );
    return c.json(result, 200);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "エラーが発生しました";
    return c.json({ error: message }, 400);
  }
});

const registerVerifyRoute = createRoute({
  method: "post",
  path: "/register/verify",
  tags: ["Auth"],
  summary: "パスキー登録検証",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            challengeId: z.string(),
            response: z.any(),
            invitationId: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "登録成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            user: z.object({
              id: z.string(),
              email: z.string(),
              name: z.string().nullable(),
              role: z.string(),
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

authRoutes.openapi(registerVerifyRoute, async (c) => {
  const { challengeId, response, invitationId } = c.req.valid("json");
  const config = getWebAuthnConfig(c.env);
  const isLocalhost = config.rpId === "localhost";

  try {
    const result = await verifyWebAuthnRegistration(
      c.env.DB,
      config,
      challengeId,
      response as RegistrationResponseJSON,
      invitationId,
    );

    setCookie(c, SESSION_COOKIE_NAME, result.session.sessionId, {
      ...getSessionCookieOptions(result.session.expiresAt, isLocalhost),
    });

    const user = result.user;
    if (!user) {
      return c.json({ error: "ユーザーの作成に失敗しました" }, 400);
    }

    return c.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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

const loginOptionsRoute = createRoute({
  method: "post",
  path: "/login/options",
  tags: ["Auth"],
  summary: "ログインオプション生成",
  responses: {
    200: {
      description: "ログインオプション",
      content: {
        "application/json": {
          schema: z.object({
            options: z.any(),
            challengeId: z.string(),
          }),
        },
      },
    },
  },
});

authRoutes.openapi(loginOptionsRoute, async (c) => {
  const config = getWebAuthnConfig(c.env);

  const result = await generateWebAuthnAuthenticationOptions(c.env.DB, config);
  return c.json(result, 200);
});

const loginVerifyRoute = createRoute({
  method: "post",
  path: "/login/verify",
  tags: ["Auth"],
  summary: "ログイン検証",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            challengeId: z.string(),
            response: z.any(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "ログイン成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            user: z.object({
              id: z.string(),
              email: z.string(),
              name: z.string().nullable(),
              role: z.string(),
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

authRoutes.openapi(loginVerifyRoute, async (c) => {
  const { challengeId, response } = c.req.valid("json");
  const config = getWebAuthnConfig(c.env);
  const isLocalhost = config.rpId === "localhost";

  try {
    const result = await verifyWebAuthnAuthentication(
      c.env.DB,
      config,
      challengeId,
      response as AuthenticationResponseJSON,
    );

    setCookie(c, SESSION_COOKIE_NAME, result.session.sessionId, {
      ...getSessionCookieOptions(result.session.expiresAt, isLocalhost),
    });

    return c.json(
      {
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
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
            success: z.boolean(),
          }),
        },
      },
    },
  },
});

authRoutes.openapi(logoutRoute, async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);

  if (sessionId) {
    await deleteSession(c.env.DB, sessionId);
  }

  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
  });

  return c.json({ success: true }, 200);
});

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
            user: z
              .object({
                id: z.string(),
                email: z.string(),
                name: z.string().nullable(),
                role: z.string(),
              })
              .nullable(),
          }),
        },
      },
    },
  },
});

authRoutes.openapi(meRoute, async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);

  if (!sessionId) {
    return c.json({ user: null }, 200);
  }

  const user = await getUserFromSession(c.env.DB, sessionId);

  if (!user) {
    return c.json({ user: null }, 200);
  }

  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    },
    200,
  );
});

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { HTTPException } from "hono/http-exception";
import { getTokenFromHeader } from "~/lib/auth-header";
import { errorResponse } from "~/lib/openapi-errors";
import type { SessionVariables } from "~/middleware/session-auth";
import { deleteSession, getUserFromSession } from "~/services/auth/session";
import {
  generateWebAuthnAuthenticationOptions,
  generateWebAuthnRegistrationOptions,
  verifyWebAuthnAuthentication,
  verifyWebAuthnRegistration,
  type WebAuthnConfig,
} from "~/services/auth/webauthn";

const RegistrationOptionsSchema = z
  .object({
    challenge: z.string(),
    rp: z.object({
      name: z.string(),
      id: z.string().optional(),
    }),
    user: z.object({
      id: z.string(),
      name: z.string(),
      displayName: z.string(),
    }),
    pubKeyCredParams: z.array(
      z.object({
        type: z.literal("public-key"),
        alg: z.number(),
      }),
    ),
    timeout: z.number().optional(),
    attestation: z.string().optional(),
    authenticatorSelection: z
      .object({
        authenticatorAttachment: z.string().optional(),
        residentKey: z.string().optional(),
        requireResidentKey: z.boolean().optional(),
        userVerification: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const RegistrationResponseSchema = z
  .object({
    id: z.string(),
    rawId: z.string(),
    response: z
      .object({
        clientDataJSON: z.string(),
        attestationObject: z.string(),
      })
      .passthrough(),
    type: z.literal("public-key"),
    clientExtensionResults: z.object({}).passthrough(),
  })
  .passthrough();

const AuthenticationOptionsSchema = z
  .object({
    challenge: z.string(),
    timeout: z.number().optional(),
    rpId: z.string().optional(),
    userVerification: z.string().optional(),
    allowCredentials: z
      .array(
        z
          .object({
            id: z.string(),
            type: z.literal("public-key"),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const AuthenticationResponseSchema = z
  .object({
    id: z.string(),
    rawId: z.string(),
    response: z
      .object({
        clientDataJSON: z.string(),
        authenticatorData: z.string(),
        signature: z.string(),
      })
      .passthrough(),
    type: z.literal("public-key"),
    clientExtensionResults: z.object({}).passthrough(),
  })
  .passthrough();

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
      required: true,
    },
  },
  responses: {
    200: {
      description: "登録オプション",
      content: {
        "application/json": {
          schema: z.object({
            options: RegistrationOptionsSchema,
            challengeId: z.string(),
            email: z.string(),
            invitationId: z.string(),
          }),
        },
      },
    },
    400: errorResponse(400),
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
    throw new HTTPException(400, { message });
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
            response: RegistrationResponseSchema,
            invitationId: z.string(),
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
            token: z.string(),
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
    400: errorResponse(400),
  },
});

authRoutes.openapi(registerVerifyRoute, async (c) => {
  const { challengeId, response, invitationId } = c.req.valid("json");
  const config = getWebAuthnConfig(c.env);

  try {
    const result = await verifyWebAuthnRegistration(
      c.env.DB,
      config,
      challengeId,
      response as RegistrationResponseJSON,
      invitationId,
    );

    const user = result.user;
    if (!user) {
      throw new HTTPException(400, {
        message: "ユーザーの作成に失敗しました",
      });
    }

    return c.json(
      {
        token: result.session.sessionId,
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
    if (error instanceof HTTPException) throw error;
    const message =
      error instanceof Error ? error.message : "エラーが発生しました";
    throw new HTTPException(400, { message });
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
            options: AuthenticationOptionsSchema,
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
            response: AuthenticationResponseSchema,
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
            token: z.string(),
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
    400: errorResponse(400),
  },
});

authRoutes.openapi(loginVerifyRoute, async (c) => {
  const { challengeId, response } = c.req.valid("json");
  const config = getWebAuthnConfig(c.env);

  try {
    const result = await verifyWebAuthnAuthentication(
      c.env.DB,
      config,
      challengeId,
      response as AuthenticationResponseJSON,
    );

    return c.json(
      {
        token: result.session.sessionId,
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
    throw new HTTPException(400, { message });
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
            message: z.string(),
          }),
        },
      },
    },
  },
});

authRoutes.openapi(logoutRoute, async (c) => {
  const sessionId = getTokenFromHeader(c);

  if (sessionId) {
    await deleteSession(c.env.DB, sessionId);
  }

  return c.json({ message: "ログアウトしました" }, 200);
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
  const sessionId = getTokenFromHeader(c);

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

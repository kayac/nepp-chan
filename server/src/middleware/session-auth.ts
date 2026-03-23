import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getTokenFromHeader } from "~/lib/auth-header";
import { logger } from "~/lib/logger";
import { type AuthUser, verifyAccessToken } from "~/services/auth/session";

type SessionVariables = {
  adminUser: AuthUser;
};

export const sessionAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: SessionVariables;
}>(async (c, next) => {
  const token = getTokenFromHeader(c);

  if (!token) {
    logger.warn("[Auth] missing access token");
    throw new HTTPException(401, { message: "認証トークンがありません" });
  }

  try {
    const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
    c.set("adminUser", {
      id: payload.sub,
      username: payload.username,
      name: payload.name,
      role: payload.role,
    });
    await next();
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.warn("[Auth] invalid access token");
    throw new HTTPException(401, { message: "無効なトークンです" });
  }
});

export const optionalSessionAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: Partial<SessionVariables>;
}>(async (c, next) => {
  const token = getTokenFromHeader(c);

  if (token) {
    try {
      const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
      c.set("adminUser", {
        id: payload.sub,
        username: payload.username,
        name: payload.name,
        role: payload.role,
      });
    } catch {
      // トークンが無効でもリクエストは続行
    }
  }

  await next();
});

export type { AuthUser, SessionVariables };

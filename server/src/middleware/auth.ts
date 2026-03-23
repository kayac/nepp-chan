import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getTokenFromHeader } from "~/lib/auth-header";
import { logger } from "~/lib/logger";
import type { AuthUser } from "~/schemas/auth-schema";
import { verifyAccessToken } from "~/services/auth/token";

type AuthVariables = {
  adminUser: AuthUser;
};

export const resolveAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: Partial<AuthVariables>;
}>(async (c, next) => {
  const token = getTokenFromHeader(c);

  if (token) {
    try {
      const user = await verifyAccessToken(token, c.env.JWT_SECRET);
      c.set("adminUser", user);
    } catch {
      // トークンが無効でもリクエストは続行
    }
  }

  await next();
});

export const requireAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: AuthVariables;
}>(async (c, next) => {
  if (!c.get("adminUser")) {
    logger.warn("[Auth] missing or invalid access token");
    throw new HTTPException(401, { message: "認証が必要です" });
  }
  await next();
});

export type { AuthUser, AuthVariables };

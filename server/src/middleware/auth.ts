import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { logger } from "~/lib/logger";
import type { PrincipalVariables } from "~/lib/principal";

export const requireAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>(async (c, next) => {
  if (!c.get("principal")) {
    logger.warn("[Auth] missing or invalid access token");
    throw new HTTPException(401, { message: "認証が必要です" });
  }
  await next();
});

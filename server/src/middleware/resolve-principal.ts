import { createMiddleware } from "hono/factory";
import { getTokenFromHeader } from "~/lib/auth-header";
import { logger } from "~/lib/logger";
import type { PrincipalVariables } from "~/lib/principal";
import { verifyAnonymousToken } from "~/services/auth/anonymous-session";
import { verifyAccessToken } from "~/services/auth/token";

export const resolvePrincipal = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>(async (c, next) => {
  const token = getTokenFromHeader(c);
  if (!token) {
    await next();
    return;
  }

  // admin JWT を先に試行（aud が異なるので片方のみ成功する）
  try {
    const user = await verifyAccessToken(token, c.env.JWT_SECRET);
    c.set("principal", { type: "admin", id: user.id, user });
    await next();
    return;
  } catch {}

  // anonymous JWT を試行
  try {
    const resourceId = await verifyAnonymousToken(token, c.env.JWT_SECRET);
    c.set("principal", { type: "anonymous", id: resourceId });
  } catch {
    // 両方失敗 = 不正なトークン
    logger.warn("[Auth] invalid bearer token, neither admin nor anonymous");
  }

  await next();
});

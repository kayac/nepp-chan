import { createMiddleware } from "hono/factory";
import { getTokenFromHeader } from "~/lib/auth-header";
import { logger } from "~/lib/logger";
import type { PrincipalVariables } from "~/lib/principal";
import { adminSessionRepository } from "~/repository/admin-session-repository";
import { adminUserRepository } from "~/repository/admin-user-repository";
import { adminRoleSchema } from "~/schemas/auth-schema";
import { verifyAnonymousToken } from "~/services/auth/anonymous-session";

export const resolvePrincipal = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>(async (c, next) => {
  const token = getTokenFromHeader(c);
  if (!token) {
    await next();
    return;
  }

  // opaque session を試行（admin）
  const session = await adminSessionRepository.findValid(c.env.DB, token);
  if (session) {
    const user = await adminUserRepository.findById(c.env.DB, session.userId);
    if (user) {
      const roleResult = adminRoleSchema.safeParse(user.role);
      if (roleResult.success) {
        c.set("principal", {
          type: "admin",
          id: user.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: roleResult.data,
          },
        });
      } else {
        logger.warn("[Auth] admin user has invalid role", {
          userId: user.id,
          role: user.role,
        });
      }
    }
    await next();
    return;
  }

  // anonymous JWT を試行
  try {
    const resourceId = await verifyAnonymousToken(token, c.env.JWT_SECRET);
    c.set("principal", { type: "anonymous", id: resourceId });
  } catch {
    logger.warn("[Auth] invalid bearer token");
  }

  await next();
});

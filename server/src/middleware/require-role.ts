import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { PrincipalVariables } from "~/lib/principal";
import type { AdminRole } from "~/schemas/auth-schema";

export const ROLE_LEVEL: Record<AdminRole, number> = {
  super_admin: 3,
  admin: 2,
  staff: 1,
};

export const requireRole = (minRole: AdminRole) =>
  createMiddleware<{
    Bindings: CloudflareBindings;
    Variables: Partial<PrincipalVariables>;
  }>(async (c, next) => {
    const principal = c.get("principal");
    if (!principal) {
      throw new HTTPException(401, { message: "認証が必要です" });
    }
    if (principal.type !== "admin") {
      throw new HTTPException(403, {
        message: "この操作を行う権限がありません",
      });
    }
    const userLevel = ROLE_LEVEL[principal.user.role];
    if (userLevel < ROLE_LEVEL[minRole]) {
      throw new HTTPException(403, {
        message: "この操作を行う権限がありません",
      });
    }
    await next();
  });

import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { PrincipalVariables } from "~/lib/principal";

const ROLE_LEVEL = { super_admin: 3, admin: 2, staff: 1 } as const;

type AdminRole = keyof typeof ROLE_LEVEL;

export const requireRole = (minRole: AdminRole) =>
  createMiddleware<{
    Bindings: CloudflareBindings;
    Variables: Partial<PrincipalVariables>;
  }>(async (c, next) => {
    const principal = c.get("principal");
    if (!principal || principal.type !== "admin") {
      throw new HTTPException(403, {
        message: "この操作を行う権限がありません",
      });
    }
    const userLevel = ROLE_LEVEL[principal.user.role as AdminRole] ?? 0;
    if (userLevel < ROLE_LEVEL[minRole]) {
      throw new HTTPException(403, {
        message: "この操作を行う権限がありません",
      });
    }
    await next();
  });

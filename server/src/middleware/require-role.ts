import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AuthVariables } from "./auth";

const ROLE_LEVEL = { super_admin: 3, admin: 2, staff: 1 } as const;

type AdminRole = keyof typeof ROLE_LEVEL;

export const requireRole = (minRole: AdminRole) =>
  createMiddleware<{
    Bindings: CloudflareBindings;
    Variables: AuthVariables;
  }>(async (c, next) => {
    const user = c.get("adminUser");
    if (!user) {
      throw new HTTPException(401, { message: "認証が必要です" });
    }
    const userLevel = ROLE_LEVEL[user.role as AdminRole] ?? 0;
    if (userLevel < ROLE_LEVEL[minRole]) {
      throw new HTTPException(403, {
        message: "この操作を行う権限がありません",
      });
    }
    await next();
  });

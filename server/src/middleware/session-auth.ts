import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AdminUser } from "~/db";
import { getTokenFromHeader } from "~/lib/auth-header";
import { getUserFromSession } from "~/services/auth/session";

type SessionVariables = {
  adminUser: AdminUser;
};

export const sessionAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: SessionVariables;
}>(async (c, next) => {
  const sessionId = getTokenFromHeader(c);

  if (!sessionId) {
    throw new HTTPException(401, { message: "セッションがありません" });
  }

  const user = await getUserFromSession(c.env.DB, sessionId);

  if (!user) {
    throw new HTTPException(401, { message: "無効なセッションです" });
  }

  c.set("adminUser", user);
  await next();
});

export const optionalSessionAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: Partial<SessionVariables>;
}>(async (c, next) => {
  const sessionId = getTokenFromHeader(c);

  if (sessionId) {
    const user = await getUserFromSession(c.env.DB, sessionId);
    if (user) {
      c.set("adminUser", user);
    }
  }

  await next();
});

export type { SessionVariables };

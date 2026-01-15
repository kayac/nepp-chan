import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AdminUser } from "~/db";
import { getUserFromSession } from "~/services/auth/session";

const SESSION_COOKIE_NAME = "__session";

type SessionVariables = {
  adminUser: AdminUser;
};

export const sessionAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: SessionVariables;
}>(async (c, next) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);

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
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);

  if (sessionId) {
    const user = await getUserFromSession(c.env.DB, sessionId);
    if (user) {
      c.set("adminUser", user);
    }
  }

  await next();
});

export { SESSION_COOKIE_NAME };
export type { SessionVariables };

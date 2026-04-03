import { createMiddleware } from "hono/factory";
import { verifyAnonymousToken } from "~/services/auth/anonymous-session";

export type SessionVariables = {
  sessionResourceId: string;
};

export const resolveSession = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: Partial<SessionVariables>;
}>(async (c, next) => {
  const token = c.req.header("X-Session-Token");

  if (token) {
    try {
      const resourceId = await verifyAnonymousToken(token, c.env.JWT_SECRET);
      c.set("sessionResourceId", resourceId);
    } catch {}
  }

  await next();
});

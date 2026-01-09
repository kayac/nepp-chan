import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

type AdminBindings = CloudflareBindings & {
  ADMIN_KEY?: string;
};

export const adminAuth = createMiddleware<{ Bindings: AdminBindings }>(
  async (c, next) => {
    const adminKey =
      c.req.header("X-Admin-Key") ?? c.req.query("adminKey") ?? null;
    const expectedKey = c.env.ADMIN_KEY;

    if (!expectedKey) {
      throw new HTTPException(500, { message: "ADMIN_KEY is not configured" });
    }

    if (adminKey !== expectedKey) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    await next();
  },
);

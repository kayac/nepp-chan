import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

const isAllowedOrigin = (
  origin: string,
  env: CloudflareBindings,
): string | null => {
  const allowedOrigins = ["http://localhost:5173", env.WEB_URL].filter(Boolean);

  return allowedOrigins.includes(origin) ? origin : null;
};

export const corsMiddleware: MiddlewareHandler<{
  Bindings: CloudflareBindings;
}> = async (c, next) => {
  const corsHandler = cors({
    origin: (origin) => {
      if (!origin) return null;
      return isAllowedOrigin(origin, c.env);
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "User-Agent", "Authorization"],
    credentials: true,
    maxAge: 86400,
  });

  return corsHandler(c, next);
};

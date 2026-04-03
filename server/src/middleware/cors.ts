import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { logger } from "~/lib/logger";

const isAllowedOrigin = (
  origin: string,
  env: CloudflareBindings,
): string | undefined => {
  const allowedOrigins = ["http://localhost:5173", env.WEB_URL].filter(Boolean);

  return allowedOrigins.includes(origin) ? origin : undefined;
};

export const corsMiddleware: MiddlewareHandler<{
  Bindings: CloudflareBindings;
}> = async (c, next) => {
  const corsHandler = cors({
    origin: (origin) => {
      if (!origin) return undefined;
      const allowed = isAllowedOrigin(origin, c.env);
      if (!allowed) {
        logger.warn("[CORS] rejected origin", { origin });
      }
      return allowed;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "User-Agent",
      "Authorization",
      "X-Session-Token",
    ],
    credentials: true,
    maxAge: 86400,
  });

  return corsHandler(c, next);
};

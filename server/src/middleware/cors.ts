import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: ["https://aiss-nepch-web-dev.pages.dev", "http://localhost:5173"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type"],
  maxAge: 86400,
});

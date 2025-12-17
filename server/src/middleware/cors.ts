import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: ["https://aiss-nepch-web-dev-8fi.pages.dev", "http://localhost:5173"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "User-Agent"],
  maxAge: 86400,
});

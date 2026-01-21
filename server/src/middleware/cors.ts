import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return null;
    if (origin === "http://localhost:5173") return origin;
    if (origin.endsWith(".aiss-nepch-web-dev-8fi.pages.dev")) return origin;
    if (origin === "https://aiss-nepch-web-dev-8fi.pages.dev") return origin;
    return null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "User-Agent", "Authorization"],
  credentials: true,
  maxAge: 86400,
});

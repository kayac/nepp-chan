import { cors } from "hono/cors";

// TODO: 本番環境では origin を適切なドメインに制限すること
// TODO: 認証認可が必要になったタイミングで実装
export const corsMiddleware = cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type"],
  maxAge: 86400,
});

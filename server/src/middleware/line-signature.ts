import { validateSignature } from "@line/bot-sdk";
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export const lineSignatureVerify: MiddlewareHandler<{
  Bindings: CloudflareBindings;
  Variables: { parsedBody: unknown };
}> = async (c, next) => {
  const signature = c.req.header("x-line-signature");
  if (!signature) {
    throw new HTTPException(401, { message: "Missing x-line-signature" });
  }

  const rawBody = await c.req.text();

  if (!validateSignature(rawBody, c.env.LINE_CHANNEL_SECRET, signature)) {
    throw new HTTPException(401, { message: "Invalid signature" });
  }

  c.set("parsedBody", JSON.parse(rawBody));
  await next();
};

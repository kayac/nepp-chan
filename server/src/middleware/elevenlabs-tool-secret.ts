import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { timingSafeEqual } from "~/lib/crypto";

export const elevenlabsToolSecretVerify: MiddlewareHandler<{
  Bindings: CloudflareBindings;
}> = async (c, next) => {
  const provided = c.req.header("x-nepp-tool-secret");
  const expected = c.env.ELEVENLABS_TOOL_SECRET;
  if (!provided || !expected || !timingSafeEqual(provided, expected)) {
    throw new HTTPException(401, { message: "Invalid tool secret" });
  }
  await next();
};

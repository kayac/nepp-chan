import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { hmacSha1Base64 } from "~/lib/crypto";
import { logger } from "~/lib/logger";

// 検証仕様: https://www.twilio.com/docs/usage/security#validating-requests
// URL 全体 + ソート済み POST パラメータの name+value 連結を
// AuthToken で HMAC-SHA1 署名したものが X-Twilio-Signature と一致すること。
export const twilioSignatureVerify: MiddlewareHandler<{
  Bindings: CloudflareBindings;
  Variables: { twilioParams: Record<string, string> };
}> = async (c, next) => {
  const signature = c.req.header("x-twilio-signature");
  if (!signature) {
    logger.warn("[Twilio] missing x-twilio-signature header");
    throw new HTTPException(401, { message: "Missing x-twilio-signature" });
  }

  const isForm = c.req
    .header("content-type")
    ?.includes("application/x-www-form-urlencoded");
  // 下流に渡す値そのものを署名対象にする（重複キーで検証値と使用値がずれるのを防ぐ）
  const params = Object.fromEntries(
    new URLSearchParams(isForm ? await c.req.text() : ""),
  );
  // トンネル/プロキシ経由では Twilio が署名した公開 URL とスキームがずれるため
  // X-Forwarded-Proto を優先する（署名鍵は攻撃者が持たないので検証は弱まらない）
  const proto = c.req.header("x-forwarded-proto")?.split(",")[0].trim();
  const url = proto ? c.req.url.replace(/^[a-z]+:/, `${proto}:`) : c.req.url;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, name) => acc + name + params[name], url);

  const expected = await hmacSha1Base64(data, c.env.TWILIO_AUTH_TOKEN);
  if (!timingSafeEqual(expected, signature)) {
    logger.warn("[Twilio] invalid signature", { url });
    throw new HTTPException(401, { message: "Invalid signature" });
  }

  c.set("twilioParams", params);
  await next();
};

const timingSafeEqual = (a: string, b: string) => {
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
};

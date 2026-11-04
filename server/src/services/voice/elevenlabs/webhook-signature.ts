import { hmacSha256Hex, timingSafeEqual } from "~/lib/crypto";

const TOLERANCE_MS = 30 * 60 * 1000;

// elevenlabs-js の webhooks.constructEvent と同じ検証: `t=<unix秒>,v0=<hex>` で `${t}.${rawBody}` を署名
export const verifyWebhookSignature = async ({
  header,
  body,
  secret,
  now = Date.now(),
}: {
  header: string | undefined;
  body: string;
  secret: string;
  now?: number;
}) => {
  if (!header) return false;
  const parts = header.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signature = parts.find((p) => p.startsWith("v0="))?.slice(3);
  if (!timestamp || !signature) return false;
  if (Number(timestamp) * 1000 < now - TOLERANCE_MS) return false;
  const expected = await hmacSha256Hex(`${timestamp}.${body}`, secret);
  return timingSafeEqual(expected, signature);
};

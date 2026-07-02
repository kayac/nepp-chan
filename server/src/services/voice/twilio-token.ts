import { sign, verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import { base64UrlFromString, hmacSha256 } from "~/lib/crypto";

// softphone（@twilio/voice-sdk）認証用の Twilio AccessToken を WebCrypto だけで発行する。
// twilio npm は Workers 非互換のため使わない。JWT は API Key Secret による HS256 署名。
// 仕様: https://www.twilio.com/docs/iam/access-tokens

type VoiceAccessTokenParams = {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  identity: string;
  twimlAppSid: string;
  nowSeconds: number;
  ttlSeconds?: number;
};

export const createVoiceAccessToken = async ({
  accountSid,
  apiKeySid,
  apiKeySecret,
  identity,
  twimlAppSid,
  nowSeconds,
  ttlSeconds = 3600,
}: VoiceAccessTokenParams) => {
  const header = { cty: "twilio-fpa;v=1", typ: "JWT", alg: "HS256" };
  const payload = {
    jti: `${apiKeySid}-${nowSeconds}`,
    iss: apiKeySid,
    sub: accountSid,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
    grants: {
      identity,
      voice: { outgoing: { application_sid: twimlAppSid } },
    },
  };
  const signingInput = `${base64UrlFromString(
    JSON.stringify(header),
  )}.${base64UrlFromString(JSON.stringify(payload))}`;
  const signature = await hmacSha256(signingInput, apiKeySecret);
  return `${signingInput}.${signature}`;
};

// relay WS（wss://.../voice/relay）の入場を認可する短命トークン。
// TwiML を発行した本人であることの証明。発信者同定は setup メッセージ側で行う。
type RelayTokenPayload = JWTPayload & { iat: number; exp: number };

export const createRelayToken = (
  secret: string,
  { nowSeconds, ttlSeconds }: { nowSeconds: number; ttlSeconds: number },
) => sign({ iat: nowSeconds, exp: nowSeconds + ttlSeconds }, secret);

export const verifyRelayToken = async (token: string, secret: string) => {
  try {
    return (await verify(token, secret, "HS256")) as RelayTokenPayload;
  } catch {
    return null;
  }
};

// setup メッセージの customParameters から relay token を取り出して検証する。
export const verifySetupToken = (
  customParameters: Record<string, string> | undefined,
  secret: string,
) => {
  const token = customParameters?.token;
  return token ? verifyRelayToken(token, secret) : Promise.resolve(null);
};

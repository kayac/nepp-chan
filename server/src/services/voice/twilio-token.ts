import {
  base64UrlFromString,
  base64UrlToString,
  hmacSha256,
} from "~/lib/crypto";

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

// relay WS（wss://.../voice/relay?token=…）の入場を認可する短命トークン。
// TwiML を発行した本人であることの証明。発信者同定は setup メッセージ側で行う。
type RelayTokenPayload = { iat: number; exp: number };

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const createRelayToken = async (
  secret: string,
  { nowSeconds, ttlSeconds }: { nowSeconds: number; ttlSeconds: number },
) => {
  const payload: RelayTokenPayload = {
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const encoded = base64UrlFromString(JSON.stringify(payload));
  const signature = await hmacSha256(encoded, secret);
  return `${encoded}.${signature}`;
};

export const verifyRelayToken = async (
  token: string,
  secret: string,
  { nowSeconds }: { nowSeconds: number },
) => {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = await hmacSha256(encoded, secret);
  if (!timingSafeEqual(signature, expected)) return null;

  let payload: RelayTokenPayload;
  try {
    payload = JSON.parse(base64UrlToString(encoded));
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp < nowSeconds) return null;
  return payload;
};

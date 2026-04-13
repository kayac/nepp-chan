import { sign, verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";

const JWT_ISSUER = "nepp-chan";
const JWT_AUDIENCE = "nepp-chan-user";
const ANONYMOUS_TOKEN_EXPIRY_SECONDS = 90 * 24 * 60 * 60; // 90日

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AnonymousJwtPayload = JWTPayload & {
  sub: string;
  iss: string;
  aud: string;
};

export const isValidUuidV4 = (value: string): boolean =>
  UUID_V4_REGEX.test(value);

export const generateAnonymousToken = async (
  resourceId: string,
  secret: string,
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const payload: AnonymousJwtPayload = {
    sub: resourceId,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + ANONYMOUS_TOKEN_EXPIRY_SECONDS,
  };
  return sign(payload, secret);
};

export const verifyAnonymousToken = async (
  token: string,
  secret: string,
): Promise<string> => {
  const payload = (await verify(token, secret, "HS256")) as AnonymousJwtPayload;

  if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) {
    throw new Error("無効なトークンです");
  }

  return payload.sub;
};

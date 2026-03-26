import { sign, verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import type { AuthUser } from "~/schemas/auth-schema";

const JWT_ISSUER = "nepp-chan";
const JWT_AUDIENCE = "nepp-chan-admin";
const ACCESS_TOKEN_EXPIRY_SECONDS = 8 * 60 * 60; // 8時間

type JwtPayload = JWTPayload &
  Omit<AuthUser, "id"> & {
    sub: string;
    iss: string;
    aud: string;
  };

export const generateAccessToken = async (
  user: AuthUser,
  secret: string,
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY_SECONDS,
  };
  return sign(payload, secret);
};

export const verifyAccessToken = async (
  token: string,
  secret: string,
): Promise<AuthUser> => {
  const payload = (await verify(token, secret, "HS256")) as JwtPayload;

  if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) {
    throw new Error("無効なトークンです");
  }

  return {
    id: payload.sub,
    username: payload.username,
    name: payload.name,
    role: payload.role,
  };
};

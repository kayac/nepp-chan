import { HTTPException } from "hono/http-exception";
import { hmacSha256 } from "~/lib/crypto";
import type { AuthUser } from "~/schemas/auth-schema";

export type AnonymousPrincipal = { type: "anonymous"; id: string };
export type AdminPrincipal = { type: "admin"; id: string; user: AuthUser };
export type LinePrincipal = { type: "line"; id: string };

export type Principal = AnonymousPrincipal | AdminPrincipal | LinePrincipal;

export type PrincipalVariables = {
  principal: Principal;
};

export const toResourceId = (p: Principal): string => {
  switch (p.type) {
    case "anonymous":
      return p.id;
    case "admin":
      return `admin:${p.id}`;
    case "line":
      // LINE ケースはハッシュ化が必須。誤って平文 resourceId が永続化されないよう、
      // 平文を返さず toLineResourceId() の利用を強制する。
      throw new Error(
        "toResourceId: LINE principal は toLineResourceId(p, secret) を使ってください",
      );
  }
};

export const toLineResourceId = async (p: LinePrincipal, secret: string) =>
  `line:${await hmacSha256(p.id, secret)}`;

export const toLineThreadId = async (p: LinePrincipal, secret: string) =>
  `line-thread:${await hmacSha256(p.id, secret)}`;

// 1 回の HMAC 計算で resourceId / threadId / hashedUserId をまとめて生成する。
// 同じ LINE userId から複数の派生 ID が必要な呼び出し側で利用する。
export const toLineIds = async (p: LinePrincipal, secret: string) => {
  const hashedUserId = await hmacSha256(p.id, secret);
  return {
    hashedUserId,
    resourceId: `line:${hashedUserId}`,
    threadId: `line-thread:${hashedUserId}`,
  };
};

// 音声通話の発信元（softphone の client:… / PSTN の +81…）から
// resourceId / threadId / hashedFrom をまとめて生成する。LINE と同様に
// 平文の発信元が永続化されないよう HMAC でハッシュ化し、voice 名前空間を分ける。
export const toVoiceIds = async (from: string, secret: string) => {
  const hashedFrom = await hmacSha256(from, secret);
  return {
    hashedFrom,
    resourceId: `voice:${hashedFrom}`,
    threadId: `voice-thread:${hashedFrom}`,
  };
};

export const requireAdminUser = (
  principal: Principal | undefined,
): AuthUser => {
  if (principal?.type !== "admin") {
    throw new HTTPException(403, { message: "管理者権限が必要です" });
  }
  return principal.user;
};

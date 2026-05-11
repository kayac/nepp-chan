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

export const requireAdminUser = (
  principal: Principal | undefined,
): AuthUser => {
  if (!principal || principal.type !== "admin") {
    throw new HTTPException(403, { message: "管理者権限が必要です" });
  }
  return principal.user;
};

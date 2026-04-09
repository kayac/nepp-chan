import { HTTPException } from "hono/http-exception";
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
      return `line:${p.id}`;
  }
};

export const requireAdminUser = (
  principal: Principal | undefined,
): AuthUser => {
  if (!principal || principal.type !== "admin") {
    throw new HTTPException(403, { message: "管理者権限が必要です" });
  }
  return principal.user;
};

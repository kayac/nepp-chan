import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import {
  type AdminPrincipal,
  type AnonymousPrincipal,
  type LinePrincipal,
  requireAdminUser,
  toResourceId,
} from "~/lib/principal";

describe("toResourceId", () => {
  it("anonymous: id をそのまま返す", () => {
    const p: AnonymousPrincipal = { type: "anonymous", id: "uuid-1234" };
    expect(toResourceId(p)).toBe("uuid-1234");
  });

  it("admin: admin: プレフィックス付きで返す", () => {
    const p: AdminPrincipal = {
      type: "admin",
      id: "admin-1",
      user: {
        id: "admin-1",
        username: "test",
        name: null,
        role: "admin" as const,
      },
    };
    expect(toResourceId(p)).toBe("admin:admin-1");
  });

  it("line: line: プレフィックス付きで返す", () => {
    const p: LinePrincipal = { type: "line", id: "U1234567890" };
    expect(toResourceId(p)).toBe("line:U1234567890");
  });
});

describe("requireAdminUser", () => {
  it("admin principal から AuthUser を返す", () => {
    const user = {
      id: "admin-1",
      username: "test",
      name: "テスト",
      role: "admin" as const,
    };
    const p: AdminPrincipal = { type: "admin", id: "admin-1", user };
    expect(requireAdminUser(p)).toEqual(user);
  });

  it("anonymous principal で HTTPException(403) をスローする", () => {
    const p: AnonymousPrincipal = { type: "anonymous", id: "uuid-1234" };
    expect(() => requireAdminUser(p)).toThrow(HTTPException);
  });

  it("undefined で HTTPException(403) をスローする", () => {
    expect(() => requireAdminUser(undefined)).toThrow(HTTPException);
  });
});

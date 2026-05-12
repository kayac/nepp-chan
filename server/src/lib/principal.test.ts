import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import {
  type AdminPrincipal,
  type AnonymousPrincipal,
  type LinePrincipal,
  requireAdminUser,
  toLineResourceId,
  toLineThreadId,
  toResourceId,
} from "./principal";

const SECRET = "test-secret-key";

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

  it("line: 平文ハッシュ化忘れ防止のため必ず throw する", () => {
    const p: LinePrincipal = { type: "line", id: "U1234567890" };
    expect(() => toResourceId(p)).toThrow(/toLineResourceId/);
  });
});

describe("toLineResourceId", () => {
  it("line: プレフィックス付きの base64url ハッシュを返す", async () => {
    const p: LinePrincipal = { type: "line", id: "U1234567890" };
    const out = await toLineResourceId(p, SECRET);
    expect(out).toMatch(/^line:[A-Za-z0-9_-]{43}$/);
  });

  it("同じ userId / secret から同じ resourceId が再現される（会話継続性）", async () => {
    const p: LinePrincipal = { type: "line", id: "U1234567890" };
    const a = await toLineResourceId(p, SECRET);
    const b = await toLineResourceId(p, SECRET);
    expect(a).toBe(b);
  });

  it("異なる userId は異なる resourceId になる", async () => {
    const a = await toLineResourceId({ type: "line", id: "Uaaa" }, SECRET);
    const b = await toLineResourceId({ type: "line", id: "Ubbb" }, SECRET);
    expect(a).not.toBe(b);
  });

  it("出力に平文 userId を含まない", async () => {
    const out = await toLineResourceId(
      { type: "line", id: "U1234567890" },
      SECRET,
    );
    expect(out).not.toContain("U1234567890");
  });
});

describe("toLineThreadId", () => {
  it("line-thread: プレフィックス付きの base64url ハッシュを返す", async () => {
    const out = await toLineThreadId(
      { type: "line", id: "U1234567890" },
      SECRET,
    );
    expect(out).toMatch(/^line-thread:[A-Za-z0-9_-]{43}$/);
  });

  it("toLineResourceId と toLineThreadId は同じハッシュを共有する", async () => {
    const p: LinePrincipal = { type: "line", id: "U1234567890" };
    const resourceId = await toLineResourceId(p, SECRET);
    const threadId = await toLineThreadId(p, SECRET);
    expect(resourceId.replace("line:", "")).toBe(
      threadId.replace("line-thread:", ""),
    );
  });

  it("出力に平文 userId を含まない", async () => {
    const out = await toLineThreadId(
      { type: "line", id: "U1234567890" },
      SECRET,
    );
    expect(out).not.toContain("U1234567890");
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

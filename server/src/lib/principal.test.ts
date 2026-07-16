import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import {
  type AdminPrincipal,
  type AnonymousPrincipal,
  type LinePrincipal,
  requireAdminUser,
  toLineIds,
  toLineResourceId,
  toLineThreadId,
  toResourceId,
  toVoiceIds,
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

describe("toLineIds", () => {
  it("resourceId / threadId / hashedUserId をまとめて返す", async () => {
    const p: LinePrincipal = { type: "line", id: "U1234567890" };
    const ids = await toLineIds(p, SECRET);
    expect(ids.hashedUserId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ids.resourceId).toBe(`line:${ids.hashedUserId}`);
    expect(ids.threadId).toBe(`line-thread:${ids.hashedUserId}`);
  });

  it("toLineResourceId / toLineThreadId と同じ値を返す（互換性）", async () => {
    const p: LinePrincipal = { type: "line", id: "U1234567890" };
    const [ids, resourceId, threadId] = await Promise.all([
      toLineIds(p, SECRET),
      toLineResourceId(p, SECRET),
      toLineThreadId(p, SECRET),
    ]);
    expect(ids.resourceId).toBe(resourceId);
    expect(ids.threadId).toBe(threadId);
  });

  it("出力に平文 userId を含まない", async () => {
    const ids = await toLineIds({ type: "line", id: "U1234567890" }, SECRET);
    expect(ids.hashedUserId).not.toContain("U1234567890");
    expect(ids.resourceId).not.toContain("U1234567890");
    expect(ids.threadId).not.toContain("U1234567890");
  });
});

describe("toVoiceIds", () => {
  it("resourceId / threadId / hashedFrom をまとめて返す", async () => {
    const ids = await toVoiceIds("client:abc123", "CA123", SECRET);
    expect(ids.hashedFrom).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ids.resourceId).toBe(`voice:${ids.hashedFrom}`);
    expect(ids.threadId).toMatch(/^voice-thread:[A-Za-z0-9_-]{43}$/);
  });

  it("同じ発信元 / callSid / secret から同じ ID が再現される", async () => {
    const a = await toVoiceIds("+81901234567", "CA123", SECRET);
    const b = await toVoiceIds("+81901234567", "CA123", SECRET);
    expect(a.resourceId).toBe(b.resourceId);
    expect(a.threadId).toBe(b.threadId);
  });

  it("異なる発信元は異なる resourceId になる", async () => {
    const a = await toVoiceIds("client:aaa", "CA123", SECRET);
    const b = await toVoiceIds("client:bbb", "CA123", SECRET);
    expect(a.resourceId).not.toBe(b.resourceId);
  });

  it("同じ発信元でも通話が異なれば threadId を分ける", async () => {
    const a = await toVoiceIds("client:abc123", "CA123", SECRET);
    const b = await toVoiceIds("client:abc123", "CA456", SECRET);
    expect(a.resourceId).toBe(b.resourceId);
    expect(a.threadId).not.toBe(b.threadId);
  });

  it("出力に平文の発信元を含まない", async () => {
    const ids = await toVoiceIds("client:secret-caller", "CA123", SECRET);
    expect(ids.hashedFrom).not.toContain("secret-caller");
    expect(ids.resourceId).not.toContain("secret-caller");
    expect(ids.threadId).not.toContain("secret-caller");
  });

  it("LINE と voice は同じ生入力でも名前空間が分かれる", async () => {
    const voice = await toVoiceIds("U1234567890", "CA123", SECRET);
    const line = await toLineIds({ type: "line", id: "U1234567890" }, SECRET);
    expect(voice.resourceId).not.toBe(line.resourceId);
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

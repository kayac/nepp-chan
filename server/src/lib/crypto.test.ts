import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  base64UrlFromString,
  base64UrlToString,
  generateId,
  generateToken,
  hmacSha1Base64,
  hmacSha256,
  sha256Hex,
} from "./crypto";

describe("hmacSha256", () => {
  it("同じ value と secret から決定的に同じ値を返す", async () => {
    const a = await hmacSha256("U1234567890", "secret");
    const b = await hmacSha256("U1234567890", "secret");
    expect(a).toBe(b);
  });

  it("value が異なれば異なる値を返す", async () => {
    const a = await hmacSha256("U1234567890", "secret");
    const b = await hmacSha256("U0987654321", "secret");
    expect(a).not.toBe(b);
  });

  it("secret が異なれば異なる値を返す", async () => {
    const a = await hmacSha256("U1234567890", "secret-a");
    const b = await hmacSha256("U1234567890", "secret-b");
    expect(a).not.toBe(b);
  });

  it("base64url 形式（+ / = を含まない）で返す", async () => {
    const out = await hmacSha256("U1234567890", "secret");
    expect(out).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("SHA-256 由来の固定長（base64url で 43 文字）を返す", async () => {
    const out = await hmacSha256("any-value", "any-secret");
    expect(out).toHaveLength(43);
  });

  it("空文字 value でも HMAC を計算できる", async () => {
    const out = await hmacSha256("", "secret");
    expect(out).toHaveLength(43);
  });

  it("空 secret は許容しない", async () => {
    await expect(hmacSha256("value", "")).rejects.toThrow();
  });
});

describe("hmacSha1Base64", () => {
  it("node:crypto の HMAC-SHA1 + 標準 base64 と一致する", async () => {
    const expected = createHmac("sha1", "secret")
      .update("https://example.com/hook")
      .digest("base64");
    expect(await hmacSha1Base64("https://example.com/hook", "secret")).toBe(
      expected,
    );
  });

  it("secret が異なれば異なる値を返す", async () => {
    const a = await hmacSha1Base64("value", "secret-a");
    const b = await hmacSha1Base64("value", "secret-b");
    expect(a).not.toBe(b);
  });

  it("空 secret は許容しない", async () => {
    await expect(hmacSha1Base64("value", "")).rejects.toThrow();
  });
});

describe("base64Url エンコード/デコード", () => {
  it("文字列を base64url（+ / = を含まない）にエンコードする", () => {
    const out = base64UrlFromString('{"alg":"HS256"}');
    expect(out).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("エンコード→デコードで元の文字列に戻る（ASCII）", () => {
    const input = '{"jti":"SK-123","exp":1700000000}';
    expect(base64UrlToString(base64UrlFromString(input))).toBe(input);
  });

  it("マルチバイト（日本語）も往復できる", () => {
    const input = "こんにちは、ねっぷちゃん";
    expect(base64UrlToString(base64UrlFromString(input))).toBe(input);
  });
});

describe("generateId", () => {
  it("16 バイト (32 文字の hex) を返す", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("呼び出しごとに異なる値を返す", () => {
    const ids = new Set(Array.from({ length: 20 }, generateId));
    expect(ids.size).toBe(20);
  });
});

describe("generateToken", () => {
  it("32 バイト (64 文字の hex) を返す", () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("呼び出しごとに異なる値を返す", () => {
    const tokens = new Set(Array.from({ length: 20 }, generateToken));
    expect(tokens.size).toBe(20);
  });
});

describe("sha256Hex", () => {
  it("既知の入力に対して SHA-256 の hex を返す", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("同じ入力は同じハッシュ、異なる入力は異なるハッシュになる", async () => {
    expect(await sha256Hex("foo")).toBe(await sha256Hex("foo"));
    expect(await sha256Hex("foo")).not.toBe(await sha256Hex("bar"));
  });
});

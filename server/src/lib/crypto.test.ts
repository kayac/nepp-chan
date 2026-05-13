import { describe, expect, it } from "vitest";
import { hmacSha256 } from "./crypto";

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

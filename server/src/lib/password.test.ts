import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  describe("hashPassword", () => {
    it("iterations:salt:hash 形式のハッシュ文字列を返す", async () => {
      const hash = await hashPassword("password123");
      const parts = hash.split(":");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe("100000");
      expect(parts[1].length).toBeGreaterThan(0);
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it("同じパスワードでも異なるハッシュを生成する（ソルトが異なる）", async () => {
      const hash1 = await hashPassword("password123");
      const hash2 = await hashPassword("password123");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("正しいパスワードで true を返す", async () => {
      const hash = await hashPassword("correct-password");
      const result = await verifyPassword("correct-password", hash);
      expect(result).toBe(true);
    });

    it("間違ったパスワードで false を返す", async () => {
      const hash = await hashPassword("correct-password");
      const result = await verifyPassword("wrong-password", hash);
      expect(result).toBe(false);
    });

    it("空文字のパスワードも処理できる", async () => {
      const hash = await hashPassword("");
      expect(await verifyPassword("", hash)).toBe(true);
      expect(await verifyPassword("notempty", hash)).toBe(false);
    });

    it("日本語パスワードも処理できる", async () => {
      const hash = await hashPassword("パスワード123");
      expect(await verifyPassword("パスワード123", hash)).toBe(true);
      expect(await verifyPassword("パスワード124", hash)).toBe(false);
    });

    it("不正なフォーマットのハッシュではエラーになる", async () => {
      await expect(verifyPassword("pass", "invalid")).rejects.toThrow();
    });
  });

  describe("プロパティベース", () => {
    // PBKDF2 100k iter は実行が重いので numRuns は控えめに
    it("hash → verify は常に true (任意のパスワード)", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 64 }),
          async (password) => {
            const hash = await hashPassword(password);
            expect(await verifyPassword(password, hash)).toBe(true);
          },
        ),
        { numRuns: 8 },
      );
    });

    it("異なるパスワード同士の hash → verify は false", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 32 }),
            fc.string({ minLength: 1, maxLength: 32 }),
          ),
          async ([a, b]) => {
            fc.pre(a !== b);
            const hash = await hashPassword(a);
            expect(await verifyPassword(b, hash)).toBe(false);
          },
        ),
        { numRuns: 6 },
      );
    });

    it("同じパスワードを 2 回 hash すると異なるハッシュになる (ソルト)", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 32 }),
          async (password) => {
            const h1 = await hashPassword(password);
            const h2 = await hashPassword(password);
            expect(h1).not.toBe(h2);
          },
        ),
        { numRuns: 6 },
      );
    });
  });
});

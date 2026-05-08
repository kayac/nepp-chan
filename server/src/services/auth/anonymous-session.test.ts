import { describe, expect, it } from "vitest";

import {
  generateAnonymousToken,
  isValidUuidV4,
  verifyAnonymousToken,
} from "./anonymous-session";

describe("anonymous-session", () => {
  const jwtSecret = "test-jwt-secret-must-be-at-least-32-chars";
  const resourceId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

  describe("isValidUuidV4", () => {
    it("正しい UUID v4 を受け付ける", () => {
      expect(isValidUuidV4("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d")).toBe(true);
      expect(isValidUuidV4("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    });

    it("大文字の UUID v4 を受け付ける", () => {
      expect(isValidUuidV4("A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D")).toBe(true);
    });

    it("UUID v4 以外の形式を拒否する", () => {
      expect(isValidUuidV4("not-a-uuid")).toBe(false);
      expect(isValidUuidV4("")).toBe(false);
      expect(isValidUuidV4("line:user123")).toBe(false);
      // UUID v1 (version digit is 1, not 4)
      expect(isValidUuidV4("550e8400-e29b-11d4-a716-446655440000")).toBe(false);
    });
  });

  describe("generateAnonymousToken / verifyAnonymousToken", () => {
    it("トークンを生成して検証できる", async () => {
      const token = await generateAnonymousToken(resourceId, jwtSecret);

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      const result = await verifyAnonymousToken(token, jwtSecret);
      expect(result).toBe(resourceId);
    });

    it("不正なシークレットでは検証に失敗する", async () => {
      const token = await generateAnonymousToken(resourceId, jwtSecret);

      await expect(
        verifyAnonymousToken(token, "wrong-secret-wrong-secret-32-ch"),
      ).rejects.toThrow();
    });
  });
});

import { describe, expect, it } from "vitest";

import * as sessionService from "~/services/auth/session";

describe("sessionService", () => {
  const jwtSecret = "test-jwt-secret-must-be-at-least-32-chars";

  const testUser = {
    id: "user-1",
    username: "admin01",
    name: "管理者",
    role: "admin",
    passwordHash: "100000:salt:hash",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: null,
  };

  describe("generateAccessToken / verifyAccessToken", () => {
    it("Access Token を生成して検証できる", async () => {
      const token = await sessionService.generateAccessToken(
        testUser,
        jwtSecret,
      );

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      const payload = await sessionService.verifyAccessToken(token, jwtSecret);
      expect(payload.sub).toBe(testUser.id);
      expect(payload.username).toBe(testUser.username);
      expect(payload.role).toBe(testUser.role);
      expect(payload.iss).toBe("nepp-chan");
      expect(payload.aud).toBe("nepp-chan-admin");
    });

    it("不正なシークレットでは検証に失敗する", async () => {
      const token = await sessionService.generateAccessToken(
        testUser,
        jwtSecret,
      );

      await expect(
        sessionService.verifyAccessToken(token, "wrong-secret-wrong-secret-32"),
      ).rejects.toThrow();
    });

    it("有効期限が 8 時間に設定される", async () => {
      const token = await sessionService.generateAccessToken(
        testUser,
        jwtSecret,
      );

      const payload = await sessionService.verifyAccessToken(token, jwtSecret);
      const expectedExpiry = 8 * 60 * 60;
      const exp = payload.exp ?? 0;
      const iat = payload.iat ?? 0;
      expect(exp - iat).toBe(expectedExpiry);
    });
  });
});

import { describe, expect, it } from "vitest";

import * as tokenService from "~/services/auth/token";

describe("tokenService", () => {
  const jwtSecret = "test-jwt-secret-must-be-at-least-32-chars";

  const testUser = {
    id: "user-1",
    username: "admin01",
    name: "管理者",
    role: "admin",
  };

  describe("generateAccessToken / verifyAccessToken", () => {
    it("Access Token を生成して検証できる", async () => {
      const token = await tokenService.generateAccessToken(testUser, jwtSecret);

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      const user = await tokenService.verifyAccessToken(token, jwtSecret);
      expect(user).toEqual(testUser);
    });

    it("不正なシークレットでは検証に失敗する", async () => {
      const token = await tokenService.generateAccessToken(testUser, jwtSecret);

      await expect(
        tokenService.verifyAccessToken(token, "wrong-secret-wrong-secret-32"),
      ).rejects.toThrow();
    });
  });
});

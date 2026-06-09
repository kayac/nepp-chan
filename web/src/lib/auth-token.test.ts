import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getAuthToken,
  getBearerToken,
  getSessionToken,
  removeAuthToken,
  removeSessionToken,
  setAuthToken,
  setSessionToken,
} from "./auth-token";

describe("auth-token", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("auth token (admin)", () => {
    it("set / get で値を保存・取得できる", () => {
      setAuthToken("admin-token");
      expect(getAuthToken()).toBe("admin-token");
    });

    it("未設定なら null", () => {
      expect(getAuthToken()).toBeNull();
    });

    it("remove で削除できる", () => {
      setAuthToken("x");
      removeAuthToken();
      expect(getAuthToken()).toBeNull();
    });
  });

  describe("session token (anonymous)", () => {
    it("set / get で値を保存・取得できる", () => {
      setSessionToken("session");
      expect(getSessionToken()).toBe("session");
    });

    it("auth token と独立して管理される", () => {
      setAuthToken("a");
      setSessionToken("s");

      removeSessionToken();

      expect(getSessionToken()).toBeNull();
      expect(getAuthToken()).toBe("a");
    });
  });

  describe("getBearerToken (auth を優先)", () => {
    it("auth と session 両方あれば auth を返す", () => {
      setAuthToken("admin");
      setSessionToken("anon");

      expect(getBearerToken()).toBe("admin");
    });

    it("auth がなければ session を返す", () => {
      setSessionToken("anon");
      expect(getBearerToken()).toBe("anon");
    });

    it("両方なければ null", () => {
      expect(getBearerToken()).toBeNull();
    });
  });
});

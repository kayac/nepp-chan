import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getAuthToken,
  getBearerToken,
  getSessionToken,
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

  describe("session token (anonymous)", () => {
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

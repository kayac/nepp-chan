import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import { ensureContextValue } from "./context-vars";

describe("ensureContextValue", () => {
  it("値があればそのまま返す", () => {
    expect(ensureContextValue("ok", "key")).toBe("ok");
    expect(ensureContextValue(0, "key")).toBe(0);
    expect(ensureContextValue(false, "key")).toBe(false);
  });

  it("undefined なら HTTPException(500) を投げる", () => {
    try {
      ensureContextValue(undefined, "principal");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HTTPException);
      expect((e as HTTPException).status).toBe(500);
      expect((e as HTTPException).message).toContain("principal");
    }
  });

  it("null なら HTTPException(500) を投げる", () => {
    expect(() => ensureContextValue(null, "thread")).toThrow(HTTPException);
  });
});

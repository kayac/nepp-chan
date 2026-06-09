import { beforeEach, describe, expect, it } from "vitest";

import { getResourceId, setResourceId } from "./resource";

describe("resource", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("未設定なら null", () => {
    expect(getResourceId()).toBeNull();
  });

  it("set した値を get で取得できる", () => {
    setResourceId("abc-123");
    expect(getResourceId()).toBe("abc-123");
  });

  it("set で上書きできる", () => {
    setResourceId("first");
    setResourceId("second");
    expect(getResourceId()).toBe("second");
  });
});

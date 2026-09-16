import { describe, expect, it } from "vitest";
import { resolveEnvironment } from "./environments";

describe("resolveEnvironment", () => {
  it("環境名が無ければ local として解決する", () => {
    expect(resolveEnvironment(undefined).api).toBe("http://localhost:8787");
  });

  it("不明な環境名は失敗する", () => {
    expect(() => resolveEnvironment("staging")).toThrow("staging");
  });
});

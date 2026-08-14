import { describe, expect, it } from "vitest";
import { resolveEnvironment } from "./environments";

describe("resolveEnvironment", () => {
  it("環境名に対応する URL を返す", () => {
    expect(resolveEnvironment("prd").api).toBe("https://api.nepp-chan.ai");
  });

  it("環境名が無ければ local として解決する", () => {
    expect(resolveEnvironment(undefined).api).toBe("http://localhost:8787");
  });

  it("不明な環境名は失敗する", () => {
    expect(() => resolveEnvironment("staging")).toThrow("staging");
  });

  it("GA 測定 ID を持つのは prd だけ", () => {
    expect(resolveEnvironment("local").gaMeasurementId).toBeUndefined();
    expect(resolveEnvironment("dev").gaMeasurementId).toBeUndefined();
    expect(resolveEnvironment("prd").gaMeasurementId).toBe("G-FMW4FP326K");
  });
});

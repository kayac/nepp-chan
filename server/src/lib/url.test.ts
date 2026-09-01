import { describe, expect, it } from "vitest";
import { hostOf, normalizeUrl } from "./url";

describe("normalizeUrl", () => {
  it("hash と末尾スラッシュを除去し host を小文字化する", () => {
    expect(normalizeUrl("https://Example.COM/path/#section")).toBe(
      "https://example.com/path",
    );
  });

  it("クエリ文字列は保持する", () => {
    expect(normalizeUrl("https://example.com/p?id=1")).toBe(
      "https://example.com/p?id=1",
    );
  });

  it("URL として不正な文字列は null を返す", () => {
    expect(normalizeUrl("not-a-url")).toBeNull();
  });
});

describe("hostOf", () => {
  it("host を小文字化し www. を除去して返す", () => {
    expect(hostOf("https://WWW.Vill.Example.jp/page")).toBe("vill.example.jp");
    expect(hostOf("https://vill.example.jp/page")).toBe("vill.example.jp");
  });

  it("不正な URL は null を返す", () => {
    expect(hostOf("::")).toBeNull();
  });
});

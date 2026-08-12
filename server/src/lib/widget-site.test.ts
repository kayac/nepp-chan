import { describe, expect, it } from "vitest";

import { normalizeSiteHost } from "./widget-site";

describe("normalizeSiteHost", () => {
  it("www. を落とす", () => {
    expect(normalizeSiteHost("www.vill.otoineppu.hokkaido.jp")).toBe(
      "vill.otoineppu.hokkaido.jp",
    );
  });

  it("大文字と前後の空白を吸収する", () => {
    expect(normalizeSiteHost("  WWW.Vill.Otoineppu.Hokkaido.JP ")).toBe(
      "vill.otoineppu.hokkaido.jp",
    );
  });

  it("先頭以外の www. は落とさない", () => {
    expect(normalizeSiteHost("example.www.jp")).toBe("example.www.jp");
  });
});

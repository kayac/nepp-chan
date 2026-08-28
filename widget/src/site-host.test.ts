import { describe, expect, it } from "vitest";

import { resolveSiteHost, resolveSitePageUrl } from "./site-host";

describe("resolveSiteHost", () => {
  it("loader が渡す host クエリからホスト名だけを取り出す", () => {
    expect(
      resolveSiteHost("?host=https://www.vill.otoineppu.hokkaido.jp/kurashi/"),
    ).toBe("www.vill.otoineppu.hokkaido.jp");
  });

  it("loader が渡す host クエリから設置ページ URL を取り出す", () => {
    expect(
      resolveSitePageUrl(
        "?host=https://www.vill.otoineppu.hokkaido.jp/kurashi/",
      ),
    ).toBe("https://www.vill.otoineppu.hokkaido.jp/kurashi/");
  });

  it("host クエリが無ければ未指定にする", () => {
    expect(resolveSiteHost("")).toBeUndefined();
  });

  it("URL として解釈できない host は未指定にする", () => {
    expect(resolveSiteHost("?host=not-a-url")).toBeUndefined();
  });
});

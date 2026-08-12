import { describe, expect, it } from "vitest";

import { resolveSiteHost } from "./site-host";

describe("resolveSiteHost", () => {
  it("loader が渡す host クエリからホスト名だけを取り出す", () => {
    expect(
      resolveSiteHost("?host=https://www.vill.otoineppu.hokkaido.jp/kurashi/"),
    ).toBe("www.vill.otoineppu.hokkaido.jp");
  });

  it("host クエリが無ければ未指定にする", () => {
    expect(resolveSiteHost("")).toBeUndefined();
  });

  it("URL として解釈できない host は未指定にする", () => {
    expect(resolveSiteHost("?host=not-a-url")).toBeUndefined();
  });
});

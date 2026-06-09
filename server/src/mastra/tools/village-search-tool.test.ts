import { describe, expect, it } from "vitest";
import { callTool } from "~/__tests__/helpers/tool-context";
import { villageSearchTool } from "./village-search-tool";

describe("villageSearchTool.execute", () => {
  it("query を URI エンコードして検索 URL を返す", async () => {
    const result = await callTool(villageSearchTool, { query: "役場 手続き" });

    expect(result.searchUrl).toBe(
      "https://www.vill.otoineppu.hokkaido.jp/result.html?q=%E5%BD%B9%E5%A0%B4%20%E6%89%8B%E7%B6%9A%E3%81%8D",
    );
    expect(result.source).toBe("音威子府村公式サイト");
  });

  it("空文字 query でも URL を返す", async () => {
    const result = await callTool(villageSearchTool, { query: "" });

    expect(result.searchUrl).toBe(
      "https://www.vill.otoineppu.hokkaido.jp/result.html?q=",
    );
  });
});

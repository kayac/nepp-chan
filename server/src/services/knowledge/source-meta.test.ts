import { describe, expect, it } from "vitest";
import { extractSourceMeta } from "./source-meta";

describe("extractSourceMeta", () => {
  it("frontmatter から情報源メタデータを取り出す", () => {
    const content = `---
url: 'https://www.vill.otoineppu.hokkaido.jp/'
source_type: curated
source_authority: 2
verified_at: '2026-09-01'
---
# 本文
`;
    expect(extractSourceMeta(content)).toEqual({
      canonicalUrl: "https://www.vill.otoineppu.hokkaido.jp/",
      sourceType: "curated",
      sourceAuthority: 2,
      verifiedAt: "2026-09-01",
    });
  });

  it("YAML が日付型に解釈した verified_at も日付文字列にする", () => {
    const content = `---
verified_at: 2026-09-01
---
本文`;
    expect(extractSourceMeta(content).verifiedAt).toBe("2026-09-01");
  });

  it("キーが無ければ undefined を返す", () => {
    expect(extractSourceMeta("# 見出しのみ")).toEqual({
      canonicalUrl: undefined,
      sourceType: undefined,
      sourceAuthority: undefined,
      verifiedAt: undefined,
    });
  });

  it("数値に解釈できない source_authority は undefined にする", () => {
    const content = `---
source_authority: high
---
本文`;
    expect(extractSourceMeta(content).sourceAuthority).toBeUndefined();
  });
});

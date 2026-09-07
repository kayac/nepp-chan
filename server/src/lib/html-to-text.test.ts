import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  decodeHtml,
  detectCharset,
  extractPageText,
  htmlToText,
} from "./html-to-text";

describe("decodeEntities", () => {
  it("名前付き・10 進・16 進のエンティティを文字に戻す", () => {
    expect(
      decodeEntities("a &amp; b &lt;c&gt; &#12354; &#x3044; &mdash;"),
    ).toBe("a & b <c> あ い —");
  });

  it("未知のエンティティはそのまま残す", () => {
    expect(decodeEntities("&unknownthing;")).toBe("&unknownthing;");
  });
});

describe("detectCharset", () => {
  it("Content-Type ヘッダの charset を優先する", () => {
    expect(
      detectCharset('<meta charset="utf-8">', "text/html; charset=Shift_JIS"),
    ).toBe("Shift_JIS");
  });

  it("ヘッダに無ければ meta charset を見る", () => {
    expect(detectCharset('<meta charset="euc-jp">', "text/html")).toBe(
      "euc-jp",
    );
  });

  it("http-equiv の content 内 charset も拾う", () => {
    expect(
      detectCharset(
        '<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS">',
        null,
      ),
    ).toBe("Shift_JIS");
  });

  it("どこにも無ければ utf-8", () => {
    expect(detectCharset("<html>", null)).toBe("utf-8");
  });
});

describe("decodeHtml", () => {
  it("Shift_JIS のバイト列を meta charset に従ってデコードする", () => {
    const sjisBytes = new Uint8Array([
      ...new TextEncoder().encode('<meta charset="shift_jis"><p>'),
      0x89,
      0xb9,
      0x88,
      0xd0,
      0x8e,
      0x71,
      0x95,
      0x7b,
      ...new TextEncoder().encode("</p>"),
    ]);

    const html = decodeHtml(sjisBytes.buffer, "text/html");

    expect(html).toContain("音威子府");
  });

  it("不正な charset 名は utf-8 にフォールバックする", () => {
    const bytes = new TextEncoder().encode(
      '<meta charset="not-a-charset"><p>本文</p>',
    );

    expect(decodeHtml(bytes.buffer as ArrayBuffer, null)).toContain("本文");
  });
});

describe("htmlToText", () => {
  it("script / style / noscript / svg を本文から除く", () => {
    const html =
      "<script>var x = 1;</script><style>p{}</style><noscript>no js</noscript><svg><text>icon</text></svg><p>残す</p>";

    expect(htmlToText(html)).toBe("残す");
  });

  it("ブロック要素の終わりを改行に、空白を 1 つに畳む", () => {
    const html =
      "<h1>見出し</h1><p>段落   一</p><ul><li>項目1</li><li>項目2</li></ul><div>末尾<br>次行</div>";

    expect(htmlToText(html)).toBe("見出し\n段落 一\n項目1\n項目2\n末尾\n次行");
  });

  it("HTML コメントを除き、3 つ以上の連続改行を 2 つにする", () => {
    const html = "<p>a</p><!-- c --><p></p><p></p><p></p><p>b</p>";

    expect(htmlToText(html)).toBe("a\n\nb");
  });
});

describe("extractPageText", () => {
  it("og:title / og:description を優先して拾い、head は本文に含めない", () => {
    const html = `<html><head><title>タイトルタグ</title>
      <meta property="og:title" content="OG タイトル">
      <meta content="OG 説明 &amp; 補足" property="og:description">
      <meta name="description" content="通常の説明">
      </head><body><p>本文</p></body></html>`;

    const page = extractPageText(html);

    expect(page.title).toBe("OG タイトル");
    expect(page.description).toBe("OG 説明 & 補足");
    expect(page.text).toBe("本文");
  });

  it("og が無ければ title タグと meta description を使う", () => {
    const html =
      '<head><title>店のページ</title><meta name="description" content="説明文"></head><body>x</body>';

    const page = extractPageText(html);

    expect(page.title).toBe("店のページ");
    expect(page.description).toBe("説明文");
  });

  it("title も description も無ければ undefined", () => {
    const page = extractPageText("<body><p>本文だけ</p></body>");

    expect(page.title).toBeUndefined();
    expect(page.description).toBeUndefined();
    expect(page.text).toBe("本文だけ");
  });
});

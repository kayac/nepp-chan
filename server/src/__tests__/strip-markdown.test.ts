import { describe, expect, it } from "vitest";
import { stripMarkdown } from "~/routes/line";

describe("stripMarkdown", () => {
  it("太字を除去する", () => {
    expect(stripMarkdown("これは**太字**だよ")).toBe("これは太字だよ");
  });

  it("太字で囲まれた括弧付きテキストを除去する", () => {
    expect(stripMarkdown("**「音威富士スキー場」**")).toBe(
      "「音威富士スキー場」",
    );
  });

  it("インラインコードを除去する", () => {
    expect(stripMarkdown("結果は`200 OK`だよ")).toBe("結果は200 OKだよ");
  });

  it("見出しを除去する", () => {
    expect(stripMarkdown("# タイトル\n本文")).toBe("タイトル\n本文");
    expect(stripMarkdown("## サブタイトル")).toBe("サブタイトル");
  });

  it("リスト記号を「・」に変換する", () => {
    expect(stripMarkdown("- 項目1\n- 項目2")).toBe("・項目1\n・項目2");
    expect(stripMarkdown("* 項目1\n* 項目2")).toBe("・項目1\n・項目2");
  });

  it("インデント付きリスト記号を「・」に変換する", () => {
    expect(stripMarkdown("*   **営業期間**：12月")).toBe("・営業期間：12月");
  });

  it("リンクをテキストとURLに変換する", () => {
    expect(stripMarkdown("[公式サイト](https://example.com)")).toBe(
      "公式サイト https://example.com",
    );
  });

  it("コードブロックを中身のみにする", () => {
    expect(stripMarkdown("```js\nconsole.log('hello');\n```")).toBe(
      "console.log('hello');",
    );
  });

  it("水平線を除去する", () => {
    expect(stripMarkdown("上\n---\n下")).toBe("上\n\n下");
  });

  it("連続空行を1つにまとめる", () => {
    expect(stripMarkdown("上\n\n\n\n下")).toBe("上\n\n下");
  });

  it("実際のLINE応答例を正しく変換する", () => {
    const input = `お待たせ！スキーができる場所を調べてきたよ〜⛷️✨

音威子府村には**「音威富士（おといふじ）スキー場」**があるんだよ！❄️

詳しい情報はこんな感じだよ：

*   **営業期間**：12月中旬〜3月下旬
*   **定休日**：月曜日
*   **営業時間**：
    *   火・木・日：9:30〜16:30
    *   水・金：13:00〜20:00

ぜひ行ってみてね！✨`;

    const result = stripMarkdown(input);

    expect(result).not.toContain("**");
    expect(result).not.toMatch(/^\*\s/m);
    expect(result).toContain("・営業期間：12月中旬〜3月下旬");
    expect(result).toContain("・定休日：月曜日");
    expect(result).toContain("・火・木・日：9:30〜16:30");
  });
});

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { stripMarkdown } from "./strip-markdown";

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

  describe("プロパティベース", () => {
    it("Markdown 記号を含まない平文は trim 以外変化しない (idempotent on plain)", () => {
      fc.assert(
        fc.property(
          fc
            .stringMatching(/^[ぁ-んァ-ン一-龯a-zA-Z0-9 、。!?]+$/)
            .filter((s) => s.length > 0 && s.length < 200),
          (plain) => {
            // 内側の連続空白以外は変化しないはず（trim を考慮）
            const out = stripMarkdown(plain);
            expect(out).toBe(plain.trim());
          },
        ),
        { numRuns: 50 },
      );
    });

    it("2 回適用しても結果が同じ (idempotent)", () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 500 }), (input) => {
          const once = stripMarkdown(input);
          const twice = stripMarkdown(once);
          expect(twice).toBe(once);
        }),
        { numRuns: 100 },
      );
    });

    it("* を含まないテキストを ** で囲めば出力に ** は残らない", () => {
      fc.assert(
        fc.property(
          // inner 内に *・改行を含まないようにして、強調マーカーの相互作用を避ける
          fc.string({ maxLength: 100 }).filter(
            (s) =>
              s.length > 0 &&
              !s.includes("*") &&
              !s.includes("\n") &&
              // 末尾空白は強調パターンにマッチしないため除外
              !s.startsWith(" ") &&
              !s.endsWith(" "),
          ),
          (inner) => {
            const wrapped = `**${inner}**`;
            const out = stripMarkdown(wrapped);
            expect(out).not.toContain("**");
          },
        ),
        { numRuns: 50 },
      );
    });

    it("出力長は入力長以下 (Markdown 記号は除去のみで増加させない)", () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 500 }), (input) => {
          const out = stripMarkdown(input);
          // リスト記号 "- " → "・" は 2 char → 1 char、リンク [a](b) → "a b" は 4 char 削除、
          // など全て短くなるか同等の置換のため、入力長を超えない
          expect(out.length).toBeLessThanOrEqual(input.length);
        }),
        { numRuns: 100 },
      );
    });
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

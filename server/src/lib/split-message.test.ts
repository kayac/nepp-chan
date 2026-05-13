import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { splitMessagesForLine } from "./split-message";

const LINE_MAX_MESSAGES = 5;
const LINE_MAX_CHARS = 5000;

describe("splitMessagesForLine", () => {
  it("空配列を渡すと空配列を返す", () => {
    expect(splitMessagesForLine([])).toEqual([]);
  });

  it("空文字列やスペースのみのテキストをスキップする", () => {
    expect(splitMessagesForLine(["", "  ", "hello"])).toEqual(["hello"]);
  });

  it("5000文字以下のテキストはそのまま返す", () => {
    expect(splitMessagesForLine(["こんにちは"])).toEqual(["こんにちは"]);
  });

  it("5000文字を超えるテキストを分割する", () => {
    const longText = "a".repeat(12000);
    const result = splitMessagesForLine([longText]);

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(5000);
    expect(result[1]).toHaveLength(5000);
    expect(result[2]).toHaveLength(2000);
  });

  it("最大5メッセージに制限する", () => {
    const texts = Array.from({ length: 10 }, (_, i) => `msg${i}`);
    const result = splitMessagesForLine(texts);

    expect(result).toHaveLength(5);
  });

  it("長文の分割でも最大5メッセージに制限する", () => {
    const longText = "a".repeat(30000);
    const result = splitMessagesForLine([longText]);

    expect(result).toHaveLength(5);
  });

  it("複数テキストの合計が5メッセージを超える場合に切り捨てる", () => {
    const texts = [
      "a".repeat(6000), // → 2メッセージ
      "b".repeat(6000), // → 2メッセージ
      "c".repeat(6000), // → 1メッセージ（5に到達）
    ];
    const result = splitMessagesForLine(texts);

    expect(result).toHaveLength(5);
    expect(result[0]).toBe("a".repeat(5000));
    expect(result[1]).toBe("a".repeat(1000));
    expect(result[2]).toBe("b".repeat(5000));
    expect(result[3]).toBe("b".repeat(1000));
    expect(result[4]).toBe("c".repeat(5000));
  });

  it("単一テキストの分割（splitMessage 相当）が正しく動作する", () => {
    const text = "hello world";
    expect(splitMessagesForLine([text])).toEqual(["hello world"]);
  });

  describe("プロパティベース", () => {
    it("結果の各 chunk は LINE_MAX_CHARS 以下", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 8000 }), {
            minLength: 0,
            maxLength: 8,
          }),
          (texts) => {
            const result = splitMessagesForLine(texts);
            for (const chunk of result) {
              expect(chunk.length).toBeLessThanOrEqual(LINE_MAX_CHARS);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("結果の件数は常に LINE_MAX_MESSAGES 以下", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 8000 })),
          (texts) => {
            const result = splitMessagesForLine(texts);
            expect(result.length).toBeLessThanOrEqual(LINE_MAX_MESSAGES);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("単一テキスト分割: 上限以下に収まる範囲では結合すると元に戻る", () => {
      fc.assert(
        fc.property(
          fc
            .string({
              minLength: 1,
              maxLength: LINE_MAX_CHARS * LINE_MAX_MESSAGES,
            })
            .filter((s) => s.trim().length > 0),
          (text) => {
            const result = splitMessagesForLine([text]);
            // 5 chunk × 5000 = 25000 char まで保持される範囲なら結合で復元できる
            if (text.length <= LINE_MAX_CHARS * LINE_MAX_MESSAGES) {
              expect(result.join("")).toBe(text);
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it("空白のみの要素は無視される", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.constant(""),
              fc.constantFrom("   ", "\t", "\n", "  \n  "),
              fc
                .string({ minLength: 1, maxLength: 50 })
                .filter((s) => s.trim().length > 0),
            ),
          ),
          (texts) => {
            const result = splitMessagesForLine(texts);
            for (const chunk of result) {
              // 結果に含まれる chunk は trim 後に何か残るものだけのはず
              expect(chunk.length).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});

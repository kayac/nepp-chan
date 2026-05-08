import { describe, expect, it } from "vitest";
import { splitMessagesForLine } from "./split-message";

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
});

import { describe, expect, it } from "vitest";
import { stripEmoji } from "./strip-emoji";

describe("stripEmoji", () => {
  it("単体の絵文字を除去する", () => {
    expect(stripEmoji("こんにちは😊")).toBe("こんにちは");
    expect(stripEmoji("🌸")).toBe("");
  });

  it("文中・複数の絵文字を除去する", () => {
    expect(stripEmoji("音威子府そば🍜は美味しいよ✨")).toBe(
      "音威子府そばは美味しいよ",
    );
  });

  it("肌色修飾子付き・ZWJ シーケンス・国旗を除去する", () => {
    expect(stripEmoji("👍🏽")).toBe("");
    expect(stripEmoji("👨‍👩‍👧")).toBe("");
    expect(stripEmoji("🇯🇵")).toBe("");
  });

  it("異体字セレクタ付き絵文字（❤️）を除去する", () => {
    expect(stripEmoji("だいすき❤️")).toBe("だいすき");
  });

  it("絵文字を含まないテキストはそのまま返す", () => {
    expect(stripEmoji("おはよう、いい天気だね。")).toBe(
      "おはよう、いい天気だね。",
    );
  });

  it("日本語・英数字・約物は保持する", () => {
    expect(stripEmoji("音威子府村（おといねっぷ）の人口は約700人。")).toBe(
      "音威子府村（おといねっぷ）の人口は約700人。",
    );
  });
});

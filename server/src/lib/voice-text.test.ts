import { describe, expect, it } from "vitest";
import { sanitizeForSpeech } from "./voice-text";

describe("sanitizeForSpeech", () => {
  it("アスタリスク（強調・リスト記号）を除去する", () => {
    expect(sanitizeForSpeech("**音威子府そば**はおいしいよ")).toBe(
      "音威子府そばはおいしいよ",
    );
    expect(sanitizeForSpeech("* りんご")).toBe(" りんご");
  });

  it("ハッシュ（見出し）を除去する", () => {
    expect(sanitizeForSpeech("# 見どころ")).toBe(" 見どころ");
  });

  it("バッククォート・チルダを除去する", () => {
    expect(sanitizeForSpeech("`コード` ~~取り消し~~")).toBe("コード 取り消し");
  });

  it("絵文字も合わせて除去する", () => {
    expect(sanitizeForSpeech("やあ😊 **元気**？")).toBe("やあ 元気？");
  });

  it("ハイフン・全角チルダは保持する（3-4日 / 3〜4日 を壊さない）", () => {
    expect(sanitizeForSpeech("6-24")).toBe("6-24");
    expect(sanitizeForSpeech("3〜4日、約700人。")).toBe("3〜4日、約700人。");
  });

  it("装飾のない通常テキストはそのまま返す", () => {
    expect(sanitizeForSpeech("おはよう、いい天気だね。")).toBe(
      "おはよう、いい天気だね。",
    );
  });
});

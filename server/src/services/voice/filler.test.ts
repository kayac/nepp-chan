import { describe, expect, it } from "vitest";
import {
  BACKCHANNEL_FILLERS,
  isQuestionLike,
  pickFiller,
  THINKING_FILLERS,
} from "./filler";

describe("isQuestionLike", () => {
  it("問いかけを判定する", () => {
    expect(isQuestionLike("そばって美味しいの？")).toBe(true);
    expect(isQuestionLike("駅はどこ")).toBe(true);
    expect(isQuestionLike("今日の天気を教えて")).toBe(true);
  });

  it("報告・雑談は問いかけとみなさない", () => {
    expect(isQuestionLike("今日は疲れたよ")).toBe(false);
    expect(isQuestionLike("ラーメン食べたい")).toBe(false);
  });
});

describe("pickFiller", () => {
  it("報告・雑談には相槌を返す", () => {
    expect(BACKCHANNEL_FILLERS).toContain(pickFiller("今日は疲れたよ", 0));
    expect(BACKCHANNEL_FILLERS).toContain(pickFiller("ラーメン食べたい", 0));
  });

  it("index で同カテゴリ内を巡回する", () => {
    expect(pickFiller("駅はどこ", 0)).toBe(THINKING_FILLERS[0]);
    expect(pickFiller("駅はどこ", 1)).toBe(THINKING_FILLERS[1]);
    expect(pickFiller("駅はどこ", THINKING_FILLERS.length)).toBe(
      THINKING_FILLERS[0],
    );
  });

  it("カスタムのフレーズプールを使える", () => {
    const pools = { thinking: ["どれどれ"], backchannel: ["ふむ", "ほう"] };
    expect(pickFiller("駅はどこ", 0, pools)).toBe("どれどれ");
    expect(pickFiller("今日は疲れたよ", 1, pools)).toBe("ほう");
  });
});

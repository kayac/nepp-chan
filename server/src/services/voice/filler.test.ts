import { describe, expect, it } from "vitest";
import { BACKCHANNEL_FILLERS, pickFiller, THINKING_FILLERS } from "./filler";

describe("pickFiller", () => {
  it("質問には考えるリードを返す", () => {
    expect(THINKING_FILLERS).toContain(pickFiller("今日の天気を教えて", 0));
    expect(THINKING_FILLERS).toContain(pickFiller("そばって美味しいの？", 0));
    expect(THINKING_FILLERS).toContain(pickFiller("駅はどこ", 0));
  });

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

  it("読み上げ可能な短い日本語（装飾記号なし）", () => {
    for (const f of [...THINKING_FILLERS, ...BACKCHANNEL_FILLERS]) {
      expect(f.length).toBeGreaterThan(0);
      expect(f).not.toMatch(/[*#`~]/);
    }
  });
});

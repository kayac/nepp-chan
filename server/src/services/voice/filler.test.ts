import { describe, expect, it } from "vitest";
import { pickFiller, THINKING_FILLERS } from "./filler";

describe("pickFiller", () => {
  it("調べ物のあるターンには考え中のフィラーを返し、index で巡回する", () => {
    expect(pickFiller("village", 0)).toBe(THINKING_FILLERS[0]);
    expect(pickFiller("outside", 1)).toBe(THINKING_FILLERS[1]);
    expect(pickFiller("village", THINKING_FILLERS.length)).toBe(
      THINKING_FILLERS[0],
    );
  });

  it("調べないターンには既定でフィラーを返さない", () => {
    expect(pickFiller("none", 0)).toBeUndefined();
  });

  it("カスタムのフレーズプールを使える", () => {
    const pools = { thinking: ["どれどれ"], backchannel: ["ふむ", "ほう"] };
    expect(pickFiller("village", 0, pools)).toBe("どれどれ");
    expect(pickFiller("none", 1, pools)).toBe("ほう");
  });
});

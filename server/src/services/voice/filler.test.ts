import { describe, expect, it } from "vitest";
import { pickFiller, THINKING_FILLERS } from "./filler";

describe("pickFiller", () => {
  it("調べ物のあるターンには考え中のフィラーを返し、index で巡回する", () => {
    expect(pickFiller({ route: "village" }, 0)).toBe(THINKING_FILLERS[0]);
    expect(pickFiller({ route: "outside" }, 1)).toBe(THINKING_FILLERS[1]);
    expect(pickFiller({ route: "village" }, THINKING_FILLERS.length)).toBe(
      THINKING_FILLERS[0],
    );
  });

  it.each([
    ["agree", "うん！"],
    ["happy", "いいね〜！"],
    ["sad", "そっかぁ…"],
    ["surprise", "えーーーー！"],
    ["ask", "え〜〜"],
    ["listen", "うん、うん！"],
  ] as const)("雑談で相槌が %s なら「%s」を返す", (backchannel, phrase) => {
    expect(pickFiller({ route: "none", backchannel }, 0)).toBe(phrase);
  });

  it("雑談でも挨拶や相槌の種類が無いときは返さない", () => {
    expect(
      pickFiller({ route: "none", backchannel: "greeting" }, 0),
    ).toBeUndefined();
    expect(pickFiller({ route: "none" }, 0)).toBeUndefined();
  });

  it("考え中のフィラーは渡したプールを使う", () => {
    expect(pickFiller({ route: "village" }, 0, ["どれどれ"])).toBe("どれどれ");
  });
});

import { describe, expect, it } from "vitest";
import { flagLabels, primaryQuery, toDecidedParam } from "./helpers";

describe("toDecidedParam", () => {
  it("all は undefined、decided/undecided は boolean に変換する", () => {
    expect(toDecidedParam("all")).toBeUndefined();
    expect(toDecidedParam("decided")).toBe(true);
    expect(toDecidedParam("undecided")).toBe(false);
  });
});

describe("flagLabels", () => {
  it("立っているフラグだけをラベル化する", () => {
    expect(
      flagLabels({ badFeedback: true, zeroHit: false, webFallback: true }),
    ).toEqual(["Bad評価", "Web補完"]);
  });

  it("フラグが無ければ空配列", () => {
    expect(
      flagLabels({ badFeedback: false, zeroHit: false, webFallback: false }),
    ).toEqual([]);
  });
});

describe("primaryQuery", () => {
  it("先頭のクエリを返し、空なら空文字", () => {
    expect(primaryQuery(["q1", "q2"])).toBe("q1");
    expect(primaryQuery([])).toBe("");
  });
});

import { describe, expect, it } from "vitest";

import { isLeadingChoice, maxChoiceCount } from "./aggregator";

describe("maxChoiceCount", () => {
  it("空配列は 0", () => {
    expect(maxChoiceCount([])).toBe(0);
  });

  it("最大の count を返す", () => {
    expect(
      maxChoiceCount([
        { choice: "A", count: 3, percentage: 30 },
        { choice: "B", count: 7, percentage: 70 },
      ]),
    ).toBe(7);
  });
});

describe("isLeadingChoice", () => {
  it("count が maxCount と一致し maxCount > 0 なら true", () => {
    expect(isLeadingChoice({ choice: "A", count: 5, percentage: 50 }, 5)).toBe(
      true,
    );
  });

  it("count が maxCount と一致しなければ false", () => {
    expect(isLeadingChoice({ choice: "B", count: 3, percentage: 30 }, 5)).toBe(
      false,
    );
  });

  it("maxCount が 0 なら false（全部0票の状況で誰もリードしていない）", () => {
    expect(isLeadingChoice({ choice: "A", count: 0, percentage: 0 }, 0)).toBe(
      false,
    );
  });
});

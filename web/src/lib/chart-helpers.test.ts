import { describe, expect, it } from "vitest";

import {
  formatPiePercent,
  getColorAt,
  NEPP_CHART_COLORS,
} from "./chart-helpers";

describe("getColorAt", () => {
  it("デフォルトはねっぷちゃんのブランドパレット", () => {
    expect(getColorAt(0)).toBe(NEPP_CHART_COLORS[0]);
    expect(getColorAt(1)).toBe(NEPP_CHART_COLORS[1]);
  });

  it("配列長を超えると先頭から循環", () => {
    expect(getColorAt(NEPP_CHART_COLORS.length)).toBe(NEPP_CHART_COLORS[0]);
    expect(getColorAt(NEPP_CHART_COLORS.length + 2)).toBe(NEPP_CHART_COLORS[2]);
  });

  it("カスタム配列を使える", () => {
    expect(getColorAt(0, ["#000", "#fff"])).toBe("#000");
    expect(getColorAt(1, ["#000", "#fff"])).toBe("#fff");
    expect(getColorAt(2, ["#000", "#fff"])).toBe("#000");
  });

  it("空配列ならデフォルトにフォールバック", () => {
    expect(getColorAt(0, [])).toBe(NEPP_CHART_COLORS[0]);
  });
});

describe("formatPiePercent", () => {
  it("0.5 → 50%", () => {
    expect(formatPiePercent(0.5)).toBe("50%");
  });

  it("undefined → 0%", () => {
    expect(formatPiePercent(undefined)).toBe("0%");
  });

  it("0.123 → 12%（四捨五入）", () => {
    expect(formatPiePercent(0.123)).toBe("12%");
  });

  it("1 → 100%", () => {
    expect(formatPiePercent(1)).toBe("100%");
  });
});

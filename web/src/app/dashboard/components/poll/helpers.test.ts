import { describe, expect, it } from "vitest";

import {
  type ChoiceFormState,
  collectValidChoices,
  isPollFormValid,
} from "./helpers";

const choice = (id: string, value: string): ChoiceFormState => ({ id, value });

describe("collectValidChoices", () => {
  it("空白を除いた値を返す", () => {
    const result = collectValidChoices([choice("1", " a "), choice("2", "b")]);
    expect(result).toEqual(["a", "b"]);
  });

  it("空文字 / 空白のみは除外", () => {
    const result = collectValidChoices([
      choice("1", "a"),
      choice("2", ""),
      choice("3", "   "),
      choice("4", "b"),
    ]);
    expect(result).toEqual(["a", "b"]);
  });

  it("空配列はそのまま空", () => {
    expect(collectValidChoices([])).toEqual([]);
  });
});

describe("isPollFormValid", () => {
  it("title 非空 + 有効選択肢 2 件以上で true", () => {
    expect(isPollFormValid("title", ["a", "b"])).toBe(true);
    expect(isPollFormValid("title", ["a", "b", "c"])).toBe(true);
  });

  it("title が空白のみは false", () => {
    expect(isPollFormValid("   ", ["a", "b"])).toBe(false);
  });

  it("有効選択肢が 1 件以下は false", () => {
    expect(isPollFormValid("title", [])).toBe(false);
    expect(isPollFormValid("title", ["a"])).toBe(false);
  });
});

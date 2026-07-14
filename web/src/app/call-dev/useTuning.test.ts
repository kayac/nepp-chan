import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { saveTuning, TUNING_STORAGE_KEY } from "./tuning";
import { useTuning } from "./useTuning";

const defaults = { voicePreset: "morioki", speechTimeout: "600" };

describe("useTuning", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults 未取得の間は values が null", () => {
    const { result } = renderHook(() => useTuning(undefined));
    expect(result.current.values).toBeNull();
  });

  it("defaults 取得後に localStorage とマージした値を返す", () => {
    saveTuning({ voicePreset: "leda" });
    const { result } = renderHook(() => useTuning(defaults));
    expect(result.current.values).toEqual({
      voicePreset: "leda",
      speechTimeout: "600",
    });
  });

  it("update はパッチを適用し localStorage に保存する", () => {
    const { result } = renderHook(() => useTuning(defaults));
    act(() => {
      result.current.update({ speechTimeout: "800" });
    });
    expect(result.current.values?.speechTimeout).toBe("800");
    expect(
      JSON.parse(localStorage.getItem(TUNING_STORAGE_KEY) ?? "{}"),
    ).toMatchObject({ speechTimeout: "800" });
  });

  it("reset は defaults に戻し保存データを消す", () => {
    saveTuning({ voicePreset: "leda" });
    const { result } = renderHook(() => useTuning(defaults));
    act(() => {
      result.current.reset();
    });
    expect(result.current.values).toEqual(defaults);
    expect(localStorage.getItem(TUNING_STORAGE_KEY)).toBeNull();
  });
});

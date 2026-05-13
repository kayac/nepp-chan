import { describe, expect, it } from "vitest";

import { validatePassword } from "./helpers";

describe("validatePassword", () => {
  it("一致 + 8文字以上で ok", () => {
    expect(validatePassword("password1", "password1")).toEqual({ ok: true });
  });

  it("不一致でエラー", () => {
    expect(validatePassword("password1", "password2")).toEqual({
      ok: false,
      message: "パスワードが一致しません",
    });
  });

  it("8文字未満でエラー", () => {
    expect(validatePassword("short", "short")).toEqual({
      ok: false,
      message: "パスワードは8文字以上で入力してください",
    });
  });

  it("空文字は不一致より長さ違反が優先...ではなく、一致なら長さチェック", () => {
    expect(validatePassword("", "")).toEqual({
      ok: false,
      message: "パスワードは8文字以上で入力してください",
    });
  });

  it("ちょうど 8 文字なら ok", () => {
    expect(validatePassword("12345678", "12345678")).toEqual({ ok: true });
  });
});

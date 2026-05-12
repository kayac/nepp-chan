import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";

const redirectTo = vi.fn();
const searchString = { current: "" };
vi.mock("~/lib/redirect", () => ({
  redirectTo: (...args: unknown[]) => redirectTo(...args),
  getCurrentSearchParams: () => new URLSearchParams(searchString.current),
}));

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  redirectTo.mockReset();
  searchString.current = "?token=invite-tok";
});

afterEach(() => {
  localStorage.clear();
});

const { useRegisterForm } = await import("./useRegisterForm");

const submitEvent = () =>
  ({ preventDefault: vi.fn() }) as unknown as React.FormEvent;

describe("useRegisterForm", () => {
  it("token あり: 初期 error=null, token を取得", () => {
    const { result } = renderHook(() => useRegisterForm());
    expect(result.current.token).toBe("invite-tok");
    expect(result.current.error).toBeNull();
  });

  it("token なし: error に『招待トークンがありません』", () => {
    searchString.current = "";
    const { result } = renderHook(() => useRegisterForm());
    expect(result.current.token).toBeNull();
    expect(result.current.error).toBe("招待トークンがありません");
  });

  it("password 不一致でバリデーション失敗、redirect しない", async () => {
    let called = 0;
    server.use(
      http.post(`${API}/auth/register`, () => {
        called += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useRegisterForm());

    act(() => {
      result.current.setPassword("password1");
      result.current.setConfirmPassword("password2");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.error).toBe("パスワードが一致しません");
    expect(called).toBe(0);
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it("8文字未満でバリデーション失敗", async () => {
    const { result } = renderHook(() => useRegisterForm());

    act(() => {
      result.current.setPassword("short");
      result.current.setConfirmPassword("short");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.error).toBe(
      "パスワードは8文字以上で入力してください",
    );
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it("成功時に setAuthToken + redirect", async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        HttpResponse.json({
          accessToken: "new-tok",
          user: { id: "u-2", username: "bob", role: "admin", name: null },
        }),
      ),
    );

    const { result } = renderHook(() => useRegisterForm());

    act(() => {
      result.current.setPassword("password1");
      result.current.setConfirmPassword("password1");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(getAuthToken()).toBe("new-tok");
    expect(redirectTo).toHaveBeenCalledWith("/dashboard");
  });

  it("API 失敗で error 表示、redirect しない", async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        HttpResponse.json(
          { error: { code: "INVALID", message: "トークン不正" } },
          { status: 400 },
        ),
      ),
    );

    const { result } = renderHook(() => useRegisterForm());

    act(() => {
      result.current.setPassword("password1");
      result.current.setConfirmPassword("password1");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it("token なしで submit しても API を呼ばない", async () => {
    searchString.current = "";
    let called = 0;
    server.use(
      http.post(`${API}/auth/register`, () => {
        called += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useRegisterForm());

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(called).toBe(0);
  });
});

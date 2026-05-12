import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";

const redirectTo = vi.fn();
vi.mock("~/lib/redirect", () => ({
  redirectTo: (...args: unknown[]) => redirectTo(...args),
  getCurrentSearchParams: () => new URLSearchParams(""),
}));

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  redirectTo.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

// vi.mock の宣言を hoist させる必要があるので import は後段
const { useLoginForm } = await import("./useLoginForm");

const submitEvent = () =>
  ({ preventDefault: vi.fn() }) as unknown as React.FormEvent;

describe("useLoginForm", () => {
  it("初期状態は空 + isLoading=false + error=null", () => {
    const { result } = renderHook(() => useLoginForm());
    expect(result.current.username).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("成功時に setAuthToken + redirectTo('/dashboard')", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          accessToken: "admin-tok",
          user: { id: "u-1", username: "admin", role: "admin", name: null },
        }),
      ),
    );

    const { result } = renderHook(() => useLoginForm());

    act(() => {
      result.current.setUsername("admin");
      result.current.setPassword("password1");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(getAuthToken()).toBe("admin-tok");
    expect(redirectTo).toHaveBeenCalledWith("/dashboard");
    expect(result.current.error).toBeNull();
  });

  it("失敗時に error をセットし redirect しない", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { error: { code: "INVALID", message: "認証失敗" } },
          { status: 401 },
        ),
      ),
    );

    const { result } = renderHook(() => useLoginForm());

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(redirectTo).not.toHaveBeenCalled();
    expect(getAuthToken()).toBeNull();
  });

  it("送信完了で isLoading が false に戻る", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          accessToken: "tok",
          user: { id: "u-1", username: "a", role: "admin", name: null },
        }),
      ),
    );

    const { result } = renderHook(() => useLoginForm());
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.isLoading).toBe(false);
  });
});

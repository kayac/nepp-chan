import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import { useAdminUser } from "./useAdminUser";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("useAdminUser", () => {
  it("token なしは fetchCurrentUser が即 null", async () => {
    const { result } = renderHookWithQuery(() => useAdminUser());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("token あり + 200 でユーザーを返す", async () => {
    setAuthToken("admin-token");
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({
          user: { id: "u-1", username: "x", name: null, role: "admin" },
        }),
      ),
    );

    const { result } = renderHookWithQuery(() => useAdminUser());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.username).toBe("x");
  });

  it("401 でも data は null（fetchCurrentUser がトークン破棄して null 返す）", async () => {
    setAuthToken("expired");
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({ message: "expired" }, { status: 401 }),
      ),
    );

    const { result } = renderHookWithQuery(() => useAdminUser());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});

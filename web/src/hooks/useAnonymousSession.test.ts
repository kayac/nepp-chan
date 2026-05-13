import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSessionToken, setSessionToken } from "~/lib/auth-token";
import { getResourceId } from "~/lib/resource";
import { server } from "~/test/msw-server";
import { useAnonymousSession } from "./useAnonymousSession";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("useAnonymousSession", () => {
  it("既にトークンがあれば即 isReady=true・isFirstVisit=false", async () => {
    setSessionToken("existing");

    const { result } = renderHook(() => useAnonymousSession());

    expect(result.current.isReady).toBe(true);
    expect(result.current.isFirstVisit).toBe(false);
  });

  it("トークン無しなら API を叩いて取得・isFirstVisit=true", async () => {
    server.use(
      http.post(`${API}/auth/anonymous-session`, () =>
        HttpResponse.json({ token: "new-token", resourceId: "res-1" }),
      ),
    );

    const { result } = renderHook(() => useAnonymousSession());

    expect(result.current.isFirstVisit).toBe(true);
    expect(result.current.isReady).toBe(false);

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(getSessionToken()).toBe("new-token");
    expect(getResourceId()).toBe("res-1");
  });

  it("API エラーでも isReady=true には到達する（フェイルセーフ）", async () => {
    server.use(
      http.post(`${API}/auth/anonymous-session`, () => HttpResponse.error()),
    );

    const { result } = renderHook(() => useAnonymousSession());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(getSessionToken()).toBeNull();
  });

  it("5xx でも !res.ok 経路を通って isReady=true", async () => {
    server.use(
      http.post(`${API}/auth/anonymous-session`, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useAnonymousSession());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(getSessionToken()).toBeNull();
  });
});

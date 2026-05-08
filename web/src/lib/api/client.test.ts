import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "../../test/msw-server";
import { removeAuthToken, setAuthToken, setSessionToken } from "../auth-token";
import { ApiError, client, parseErrorResponse } from "./client";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  removeAuthToken();
});

describe("parseErrorResponse", () => {
  it("error.message を最優先で抽出", async () => {
    const res = new Response(
      JSON.stringify({ error: { message: "認可エラー" } }),
      { status: 403 },
    );
    expect(await parseErrorResponse(res)).toBe("認可エラー");
  });

  it("error.message が無ければ message を見る", async () => {
    const res = new Response(JSON.stringify({ message: "shallow" }), {
      status: 400,
    });
    expect(await parseErrorResponse(res)).toBe("shallow");
  });

  it("どちらも無いと汎用メッセージ + status", async () => {
    const res = new Response(JSON.stringify({}), { status: 500 });
    expect(await parseErrorResponse(res)).toMatch(/500/);
  });

  it("JSON でなくても throw せず汎用メッセージ", async () => {
    const res = new Response("not json", { status: 502 });
    expect(await parseErrorResponse(res)).toMatch(/502/);
  });
});

describe("ApiError", () => {
  it("status を保持し name は ApiError", () => {
    const err = new ApiError("失敗", 418);
    expect(err.status).toBe(418);
    expect(err.name).toBe("ApiError");
    expect(err.message).toBe("失敗");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("client: 401 fallback retry", () => {
  it("admin token で 401 → session token で再試行して 200", async () => {
    setAuthToken("expired-admin");
    setSessionToken("valid-session");

    const seenAuth: string[] = [];
    let call = 0;
    server.use(
      http.get(`${API}/admin/emergency`, ({ request }) => {
        seenAuth.push(request.headers.get("authorization") ?? "");
        call += 1;
        if (call === 1) {
          return HttpResponse.json(
            { error: { message: "expired" } },
            { status: 401 },
          );
        }
        return HttpResponse.json({ emergencies: [] });
      }),
    );

    const { data, error } = await client.GET("/admin/emergency", {
      params: { query: { limit: 10 } },
    });

    expect(error).toBeUndefined();
    expect(data).toBeDefined();
    expect(call).toBe(2);
    expect(seenAuth[0]).toBe("Bearer expired-admin");
    expect(seenAuth[1]).toBe("Bearer valid-session");
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("session token のみで 401 はリトライしない", async () => {
    setSessionToken("only-session");

    let call = 0;
    server.use(
      http.get(`${API}/threads`, () => {
        call += 1;
        return HttpResponse.json(
          { error: { message: "unauthorized" } },
          { status: 401 },
        );
      }),
    );

    await expect(
      client.GET("/threads", { params: { query: {} } }),
    ).rejects.toBeDefined();

    expect(call).toBe(1);
  });

  it("Authorization 未送信で 401 ならリトライしない", async () => {
    let call = 0;
    server.use(
      http.get(`${API}/threads`, () => {
        call += 1;
        return HttpResponse.json(
          { error: { message: "no token" } },
          { status: 401 },
        );
      }),
    );

    await expect(
      client.GET("/threads", { params: { query: {} } }),
    ).rejects.toBeDefined();

    expect(call).toBe(1);
  });

  it("admin token 401 で session token が無ければ Authorization なしで再試行", async () => {
    setAuthToken("expired-admin");
    // session token は設定しない

    const seenAuth: (string | null)[] = [];
    let call = 0;
    server.use(
      http.get(`${API}/admin/emergency`, ({ request }) => {
        seenAuth.push(request.headers.get("authorization"));
        call += 1;
        return HttpResponse.json(
          { error: { message: "expired" } },
          { status: 401 },
        );
      }),
    );

    await expect(
      client.GET("/admin/emergency", { params: { query: { limit: 10 } } }),
    ).rejects.toBeDefined();

    expect(call).toBe(2);
    expect(seenAuth[0]).toBe("Bearer expired-admin");
    expect(seenAuth[1]).toBeNull();
  });
});

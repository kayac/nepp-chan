import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  removeAuthToken,
  setAuthToken,
  setSessionToken,
} from "~/lib/auth-token";
import { server } from "~/test/msw-server";
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

/**
 * 401 retry テスト用: 各 GET の Authorization ヘッダ履歴を記録しつつ
 * 呼び出し回数で挙動を切り替える handler を登録する。
 */
const recordGetCalls = (
  path: string,
  responder: (callIndex: number) => Response,
) => {
  const seenAuth: (string | null)[] = [];
  let calls = 0;
  server.use(
    http.get(`${API}${path}`, ({ request }) => {
      seenAuth.push(request.headers.get("authorization"));
      const response = responder(calls);
      calls += 1;
      return response;
    }),
  );
  return { seenAuth, getCalls: () => calls };
};

const unauthorized = () =>
  HttpResponse.json({ error: { message: "unauthorized" } }, { status: 401 });

describe("client: 401 fallback retry", () => {
  it("admin token で 401 → session token で再試行して 200", async () => {
    setAuthToken("expired-admin");
    setSessionToken("valid-session");

    const { seenAuth, getCalls } = recordGetCalls("/admin/emergency", (i) =>
      i === 0 ? unauthorized() : HttpResponse.json({ emergencies: [] }),
    );

    const { data, error } = await client.GET("/admin/emergency", {
      params: { query: { limit: 10 } },
    });

    expect(error).toBeUndefined();
    expect(data).toBeDefined();
    expect(getCalls()).toBe(2);
    expect(seenAuth).toEqual(["Bearer expired-admin", "Bearer valid-session"]);
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("session token のみで 401 はリトライしない", async () => {
    setSessionToken("only-session");

    const { getCalls } = recordGetCalls("/threads", () => unauthorized());

    await expect(
      client.GET("/threads", { params: { query: {} } }),
    ).rejects.toBeDefined();

    expect(getCalls()).toBe(1);
  });

  it("Authorization 未送信で 401 ならリトライしない", async () => {
    const { getCalls } = recordGetCalls("/threads", () => unauthorized());

    await expect(
      client.GET("/threads", { params: { query: {} } }),
    ).rejects.toBeDefined();

    expect(getCalls()).toBe(1);
  });

  it("admin token 401 で session token が無ければ Authorization なしで再試行", async () => {
    setAuthToken("expired-admin");

    const { seenAuth, getCalls } = recordGetCalls("/admin/emergency", () =>
      unauthorized(),
    );

    await expect(
      client.GET("/admin/emergency", { params: { query: { limit: 10 } } }),
    ).rejects.toBeDefined();

    expect(getCalls()).toBe(2);
    expect(seenAuth).toEqual(["Bearer expired-admin", null]);
  });
});

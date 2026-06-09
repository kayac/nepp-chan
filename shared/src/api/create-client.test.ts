import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../test/msw-server";
import { createApiClient } from "./create-client";
import { ApiError } from "./errors";

const BASE = "http://localhost:8787";

describe("createApiClient", () => {
  describe("認証ヘッダ", () => {
    it("getAuthToken が token を返すと Authorization に Bearer 付きで載せる", async () => {
      let received: string | null = null;
      server.use(
        http.get(`${BASE}/health`, ({ request }) => {
          received = request.headers.get("Authorization");
          return HttpResponse.json({ ok: true });
        }),
      );

      const client = createApiClient({
        baseUrl: BASE,
        getAuthToken: () => "abc",
      });
      await client.GET("/health");

      expect(received).toBe("Bearer abc");
    });

    it("getAuthToken が null を返すと Authorization は付与しない", async () => {
      let received: string | null = "set";
      server.use(
        http.get(`${BASE}/health`, ({ request }) => {
          received = request.headers.get("Authorization");
          return HttpResponse.json({ ok: true });
        }),
      );

      const client = createApiClient({
        baseUrl: BASE,
        getAuthToken: () => null,
      });
      await client.GET("/health");

      expect(received).toBeNull();
    });
  });

  describe("エラー応答", () => {
    it("4xx は ApiError を reject し onServerError は呼ばない", async () => {
      const onServerError = vi.fn();
      server.use(
        http.get(`${BASE}/health`, () =>
          HttpResponse.json({ error: { message: "bad" } }, { status: 400 }),
        ),
      );

      const client = createApiClient({ baseUrl: BASE, onServerError });

      await expect(client.GET("/health")).rejects.toBeInstanceOf(ApiError);
      expect(onServerError).not.toHaveBeenCalled();
    });

    it("5xx は ApiError を reject し onServerError を呼ぶ", async () => {
      const onServerError = vi.fn();
      server.use(
        http.get(`${BASE}/health`, () =>
          HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
        ),
      );

      const client = createApiClient({ baseUrl: BASE, onServerError });

      await expect(client.GET("/health")).rejects.toBeInstanceOf(ApiError);
      expect(onServerError).toHaveBeenCalledTimes(1);
      const [error, response] = onServerError.mock.calls[0];
      expect(error).toBeInstanceOf(ApiError);
      expect(response.status).toBe(500);
    });
  });

  describe("401 fallback retry", () => {
    it("onUnauthorized 未指定なら 401 をそのまま reject する", async () => {
      let calls = 0;
      server.use(
        http.get(`${BASE}/health`, () => {
          calls += 1;
          return HttpResponse.json({ error: "u" }, { status: 401 });
        }),
      );

      const client = createApiClient({
        baseUrl: BASE,
        getAuthToken: () => "t",
      });

      await expect(client.GET("/health")).rejects.toBeInstanceOf(ApiError);
      expect(calls).toBe(1);
    });

    it("Authorization 未送信のときは onUnauthorized を呼ばない", async () => {
      const onUnauthorized = vi.fn(() => true);
      server.use(
        http.get(`${BASE}/health`, () =>
          HttpResponse.json({ error: "u" }, { status: 401 }),
        ),
      );

      const client = createApiClient({
        baseUrl: BASE,
        getAuthToken: () => null,
        onUnauthorized,
      });

      await expect(client.GET("/health")).rejects.toBeInstanceOf(ApiError);
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it("onUnauthorized が false を返すと再試行しない", async () => {
      let calls = 0;
      server.use(
        http.get(`${BASE}/health`, () => {
          calls += 1;
          return HttpResponse.json({ error: "u" }, { status: 401 });
        }),
      );

      const client = createApiClient({
        baseUrl: BASE,
        getAuthToken: () => "expired",
        onUnauthorized: () => false,
      });

      await expect(client.GET("/health")).rejects.toBeInstanceOf(ApiError);
      expect(calls).toBe(1);
    });

    it("fallback トークンが前回と異なれば差し替えて再試行する", async () => {
      const tokens: (string | null)[] = ["expired", "fresh"];
      const getAuthToken = vi.fn(() => tokens.shift() ?? null);

      const headers: (string | null)[] = [];
      server.use(
        http.get(`${BASE}/health`, ({ request }) => {
          headers.push(request.headers.get("Authorization"));
          if (headers.length === 1) {
            return HttpResponse.json({ error: "u" }, { status: 401 });
          }
          return HttpResponse.json({ ok: true });
        }),
      );

      const client = createApiClient({
        baseUrl: BASE,
        getAuthToken,
        onUnauthorized: () => true,
      });
      await client.GET("/health");

      expect(headers).toEqual(["Bearer expired", "Bearer fresh"]);
    });

    it("fallback トークンが無くなれば Authorization を外して再試行する", async () => {
      const tokens: (string | null)[] = ["expired", null];
      const getAuthToken = vi.fn(() => tokens.shift() ?? null);

      const headers: (string | null)[] = [];
      server.use(
        http.get(`${BASE}/health`, ({ request }) => {
          headers.push(request.headers.get("Authorization"));
          if (headers.length === 1) {
            return HttpResponse.json({ error: "u" }, { status: 401 });
          }
          return HttpResponse.json({ ok: true });
        }),
      );

      const client = createApiClient({
        baseUrl: BASE,
        getAuthToken,
        onUnauthorized: () => true,
      });
      await client.GET("/health");

      expect(headers).toEqual(["Bearer expired", null]);
    });

    it("fallback トークンが前回と同じなら再試行しない", async () => {
      let calls = 0;
      server.use(
        http.get(`${BASE}/health`, () => {
          calls += 1;
          return HttpResponse.json({ error: "u" }, { status: 401 });
        }),
      );

      const client = createApiClient({
        baseUrl: BASE,
        getAuthToken: () => "T",
        onUnauthorized: () => true,
      });

      await expect(client.GET("/health")).rejects.toBeInstanceOf(ApiError);
      expect(calls).toBe(1);
    });
  });
});

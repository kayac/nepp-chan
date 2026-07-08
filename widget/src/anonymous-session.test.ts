import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { acquireAnonymousSession } from "./anonymous-session";
import { server } from "./test/msw-server";

const API_URL = "http://localhost:8787";
const SESSION_TOKEN_KEY = "nepp-chan-widget:session-token";
const RESOURCE_ID_KEY = "nepp-chan-widget:resource-id";

describe("acquireAnonymousSession", () => {
  it("未取得なら POST /auth/anonymous-session に platform: widget を送って取得する", async () => {
    let requestBody: unknown;
    server.use(
      http.post(`${API_URL}/auth/anonymous-session`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({
          token: "token-1",
          resourceId: "widget-abc",
        });
      }),
    );

    const session = await acquireAnonymousSession(API_URL);

    expect(session).toEqual({ token: "token-1", resourceId: "widget-abc" });
    expect(requestBody).toEqual({ platform: "widget" });
  });

  it("取得したトークンと resourceId を localStorage に保存する", async () => {
    server.use(
      http.post(`${API_URL}/auth/anonymous-session`, () =>
        HttpResponse.json({ token: "token-1", resourceId: "widget-abc" }),
      ),
    );

    await acquireAnonymousSession(API_URL);

    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBe("token-1");
    expect(localStorage.getItem(RESOURCE_ID_KEY)).toBe("widget-abc");
  });

  it("既に localStorage に保存済みならリクエストせず再利用する", async () => {
    localStorage.setItem(SESSION_TOKEN_KEY, "stored-token");
    localStorage.setItem(RESOURCE_ID_KEY, "widget-stored");
    let called = false;
    server.use(
      http.post(`${API_URL}/auth/anonymous-session`, () => {
        called = true;
        return HttpResponse.json({ token: "new", resourceId: "widget-new" });
      }),
    );

    const session = await acquireAnonymousSession(API_URL);

    expect(session).toEqual({
      token: "stored-token",
      resourceId: "widget-stored",
    });
    expect(called).toBe(false);
  });

  it("レスポンスが失敗ステータスなら throw する", async () => {
    server.use(
      http.post(
        `${API_URL}/auth/anonymous-session`,
        () => new HttpResponse("boom", { status: 500 }),
      ),
    );

    await expect(acquireAnonymousSession(API_URL)).rejects.toThrow();
  });
});

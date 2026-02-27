import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { corsMiddleware } from "~/middleware/cors";

describe("corsMiddleware", () => {
  const createApp = (webUrl = "https://web.nepp-chan.ai") => {
    const app = new Hono<{ Bindings: CloudflareBindings }>();
    app.use("*", corsMiddleware);
    app.get("/test", (c) => c.text("ok"));
    return { app, env: { WEB_URL: webUrl } as unknown as CloudflareBindings };
  };

  const request = (
    app: Hono<{ Bindings: CloudflareBindings }>,
    env: CloudflareBindings,
    origin?: string,
  ) => {
    const headers: Record<string, string> = {};
    if (origin) headers.Origin = origin;
    return app.request("/test", { headers }, env);
  };

  it("localhost:5173 を許可する", async () => {
    const { app, env } = createApp();
    const res = await request(app, env, "http://localhost:5173");

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("WEB_URL に設定された origin を許可する", async () => {
    const { app, env } = createApp("https://web.nepp-chan.ai");
    const res = await request(app, env, "https://web.nepp-chan.ai");

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://web.nepp-chan.ai",
    );
  });

  it("許可されていない origin にはヘッダーを返さない", async () => {
    const { app, env } = createApp();
    const res = await request(app, env, "https://evil.example.com");

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("origin なしのリクエストにはヘッダーを返さない", async () => {
    const { app, env } = createApp();
    const res = await request(app, env);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("レスポンスボディに影響を与えない", async () => {
    const { app, env } = createApp();
    const res = await request(app, env, "http://localhost:5173");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});

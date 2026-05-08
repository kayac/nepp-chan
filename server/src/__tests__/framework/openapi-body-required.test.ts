import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

describe("auth ルートの body required バリデーション", () => {
  const createApp = () => {
    const app = new OpenAPIHono();

    const route = createRoute({
      method: "post",
      path: "/test",
      request: {
        body: {
          content: {
            "application/json": {
              schema: z.object({
                token: z.string(),
              }),
            },
          },
          required: true,
        },
      },
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: z.object({ ok: z.boolean() }),
            },
          },
        },
      },
    });

    app.openapi(route, (c) => {
      const body = c.req.valid("json");
      return c.json({ ok: true, body }, 200);
    });

    return app;
  };

  it("body なしで POST すると 400 エラーになる", async () => {
    const app = createApp();
    const res = await app.request("/test", { method: "POST" });

    expect(res.status).toBe(400);
  });

  it("空の body で POST すると 400 エラーになる", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("不正な body で POST すると 400 エラーになる", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: 123 }),
    });

    expect(res.status).toBe(400);
  });

  it("正しい body で POST すると 200 を返す", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token" }),
    });

    expect(res.status).toBe(200);
  });
});

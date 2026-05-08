import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

describe("クエリパラメータの数値バリデーション", () => {
  const createApp = (
    querySchema: z.ZodObject<Record<string, z.ZodTypeAny>>,
  ) => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: "get",
      path: "/test",
      request: { query: querySchema },
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: z.object({ value: z.unknown() }),
            },
          },
        },
      },
    });
    app.openapi(route, (c) => {
      const query = c.req.valid("query");
      return c.json({ value: query }, 200);
    });
    return app;
  };

  describe("z.coerce.number().int().min(1).optional().default()", () => {
    const schema = z.object({
      limit: z.coerce.number().int().min(1).optional().default(30),
    });

    it("数値文字列を受け付ける", async () => {
      const app = createApp(schema);
      const res = await app.request("/test?limit=10");

      expect(res.status).toBe(200);
    });

    it("省略時もデフォルト値で受け付ける", async () => {
      const app = createApp(schema);
      const res = await app.request("/test");

      expect(res.status).toBe(200);
    });

    it("非数値文字列を400で拒否する", async () => {
      const app = createApp(schema);
      const res = await app.request("/test?limit=abc");

      expect(res.status).toBe(400);
    });

    it("小数を400で拒否する", async () => {
      const app = createApp(schema);
      const res = await app.request("/test?limit=1.5");

      expect(res.status).toBe(400);
    });

    it("0以下を400で拒否する", async () => {
      const app = createApp(schema);
      const res = await app.request("/test?limit=0");

      expect(res.status).toBe(400);
    });

    it("負数を400で拒否する", async () => {
      const app = createApp(schema);
      const res = await app.request("/test?limit=-5");

      expect(res.status).toBe(400);
    });
  });

  describe("z.coerce.number().int().min(0).optional().default() (page)", () => {
    const schema = z.object({
      page: z.coerce.number().int().min(0).optional().default(0),
      perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
    });

    it("page=0 を許可する", async () => {
      const app = createApp(schema);
      const res = await app.request("/test?page=0");

      expect(res.status).toBe(200);
    });

    it("perPage の上限(100)を超えると400で拒否する", async () => {
      const app = createApp(schema);
      const res = await app.request("/test?perPage=101");

      expect(res.status).toBe(400);
    });
  });
});

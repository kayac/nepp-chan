import { describe, expect, it } from "vitest";

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

import { healthRoutes } from "./health";

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

describe("healthRoutes: GET /", () => {
  it("正常系: 200 を返し、message を string として持つ", async () => {
    const app = await withResolvePrincipal(healthRoutes);

    const res = await app.request("/", { method: "GET" }, mockEnv);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string };
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("Content-Type が application/json", async () => {
    const app = await withResolvePrincipal(healthRoutes);

    const res = await app.request("/", { method: "GET" }, mockEnv);

    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("異常系: POST は 404 を返す（GET 専用）", async () => {
    const app = await withResolvePrincipal(healthRoutes);

    const res = await app.request("/", { method: "POST" }, mockEnv);

    expect(res.status).toBe(404);
  });

  it("冪等性: 複数回呼んでも同じレスポンスを返す", async () => {
    const app = await withResolvePrincipal(healthRoutes);

    const res1 = await app.request("/", { method: "GET" }, mockEnv);
    const res2 = await app.request("/", { method: "GET" }, mockEnv);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(await res1.json()).toEqual(await res2.json());
  });
});

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
});

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

describe("securityHeaders ミドルウェア", () => {
  const createApp = () => {
    const app = new Hono();
    app.use("*", securityHeaders);
    app.get("/test", (c) => c.text("ok"));
    return app;
  };

  it("全てのセキュリティヘッダーが同時に設定される", async () => {
    const app = createApp();
    const res = await app.request("/test");

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(res.headers.get("X-XSS-Protection")).toBeNull();
    expect(res.headers.get("Permissions-Policy")).toBe(
      "geolocation=(), microphone=()",
    );
  });

  it("レスポンスボディに影響を与えない", async () => {
    const app = createApp();
    const res = await app.request("/test");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});

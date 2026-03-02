import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { lineSignatureVerify } from "~/middleware/line-signature";

const CHANNEL_SECRET = "test-channel-secret";

const computeSignature = async (
  body: string,
  secret: string,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
};

const createApp = () => {
  const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { parsedBody: unknown };
  }>();
  app.use("/*", lineSignatureVerify);
  app.post("/webhook", (c) => {
    const body = c.get("parsedBody");
    return c.json(body);
  });
  return app;
};

const env = {
  LINE_CHANNEL_SECRET: CHANNEL_SECRET,
} as unknown as CloudflareBindings;

describe("lineSignatureVerify", () => {
  it("正しい署名で 200 が返る", async () => {
    const app = createApp();
    const body = JSON.stringify({ events: [] });
    const signature = await computeSignature(body, CHANNEL_SECRET);

    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-line-signature": signature,
        },
        body,
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [] });
  });

  it("不正な署名で 401 が返る", async () => {
    const app = createApp();
    const body = JSON.stringify({ events: [] });

    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-line-signature": "invalid-signature",
        },
        body,
      },
      env,
    );

    expect(res.status).toBe(401);
  });

  it("x-line-signature ヘッダーがない場合に 401 が返る", async () => {
    const app = createApp();
    const body = JSON.stringify({ events: [] });

    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      },
      env,
    );

    expect(res.status).toBe(401);
  });

  it("パース済みボディが parsedBody に格納される", async () => {
    const app = createApp();
    const body = JSON.stringify({
      destination: "xxx",
      events: [{ type: "message" }],
    });
    const signature = await computeSignature(body, CHANNEL_SECRET);

    const res = await app.request(
      "/webhook",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-line-signature": signature,
        },
        body,
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      destination: "xxx",
      events: [{ type: "message" }],
    });
  });
});

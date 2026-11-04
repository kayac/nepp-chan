import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { elevenlabsToolSecretVerify } from "./elevenlabs-tool-secret";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.post("/hook", elevenlabsToolSecretVerify, (c) => c.text("ok"));

const post = (secret: string | undefined, expected = "tool-secret") =>
  app.request(
    "http://x/hook",
    {
      method: "POST",
      headers: secret ? { "x-nepp-tool-secret": secret } : {},
    },
    { ELEVENLABS_TOOL_SECRET: expected } as unknown as CloudflareBindings,
  );

describe("elevenlabsToolSecretVerify", () => {
  it("ヘッダの secret が一致すれば通す", async () => {
    expect((await post("tool-secret")).status).toBe(200);
  });

  it.each([
    ["ヘッダなし", undefined],
    ["不一致", "wrong"],
    ["長さ違い", "tool-secret-x"],
  ])("secret が不正（%s）なら 401", async (_label, secret) => {
    expect((await post(secret)).status).toBe(401);
  });

  it("環境変数の secret が未設定なら一致していても 401", async () => {
    expect((await post("", "")).status).toBe(401);
  });
});

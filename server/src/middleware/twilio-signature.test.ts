import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { twilioSignatureVerify } from "./twilio-signature";

const AUTH_TOKEN = "test-auth-token";

const signRequest = (
  url: string,
  params: Record<string, string> = {},
  token = AUTH_TOKEN,
) =>
  createHmac("sha1", token)
    .update(
      url +
        Object.keys(params)
          .sort()
          .map((name) => name + params[name])
          .join(""),
    )
    .digest("base64");

const createApp = (path = "/hook") => {
  const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { twilioParams: Record<string, string> };
  }>();
  app.post(path, twilioSignatureVerify, (c) => c.json(c.get("twilioParams")));
  return app;
};

const env = { TWILIO_AUTH_TOKEN: AUTH_TOKEN } as unknown as CloudflareBindings;

const HOOK_URL = "http://api.example.com/hook";

describe("twilioSignatureVerify", () => {
  it("x-twilio-signature ヘッダーがない場合に 401 が返る", async () => {
    const res = await createApp().request(HOOK_URL, { method: "POST" }, env);
    expect(res.status).toBe(401);
  });

  it("別のトークンで署名されたリクエストは 401 が返る", async () => {
    const res = await createApp().request(
      HOOK_URL,
      {
        method: "POST",
        headers: {
          "x-twilio-signature": signRequest(HOOK_URL, {}, "other-token"),
        },
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("body なしのリクエストは URL のみの署名で通過し twilioParams は空になる", async () => {
    const res = await createApp().request(
      HOOK_URL,
      {
        method: "POST",
        headers: { "x-twilio-signature": signRequest(HOOK_URL) },
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("form params 付きの正しい署名で通過し twilioParams に全パラメータが入る", async () => {
    const params = { voicePreset: "leda", CallSid: "CA123" };
    const res = await createApp().request(
      HOOK_URL,
      {
        method: "POST",
        headers: { "x-twilio-signature": signRequest(HOOK_URL, params) },
        body: new URLSearchParams(params),
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(params);
  });

  it("署名後に改竄された form params は 401 が返る", async () => {
    const res = await createApp().request(
      HOOK_URL,
      {
        method: "POST",
        headers: {
          "x-twilio-signature": signRequest(HOOK_URL, { CallSid: "CA123" }),
        },
        body: new URLSearchParams({ CallSid: "CA999" }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("正規署名のリクエストに同名パラメータを追記すると 401 が返る", async () => {
    const res = await createApp().request(
      HOOK_URL,
      {
        method: "POST",
        headers: {
          "x-twilio-signature": signRequest(HOOK_URL, { voicePreset: "leda" }),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "voicePreset=leda&voicePreset=evil",
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("form 以外の content-type の body は署名対象にも twilioParams にも含めない", async () => {
    const res = await createApp().request(
      HOOK_URL,
      {
        method: "POST",
        headers: {
          "x-twilio-signature": signRequest(HOOK_URL),
          "content-type": "text/plain",
        },
        body: "voicePreset=evil",
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("クエリ文字列を含む URL 全体が署名対象になる", async () => {
    const url = `${HOOK_URL}?foo=1&bar=2`;
    const res = await createApp().request(
      url,
      {
        method: "POST",
        headers: { "x-twilio-signature": signRequest(url) },
      },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("x-forwarded-proto がある場合はそのスキームの URL への署名を受理する", async () => {
    const res = await createApp().request(
      HOOK_URL,
      {
        method: "POST",
        headers: {
          "x-twilio-signature": signRequest("https://api.example.com/hook"),
          "x-forwarded-proto": "https",
        },
      },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("Twilio ドキュメントの署名例と互換の署名を受理する", async () => {
    // https://www.twilio.com/docs/usage/security の掲載例
    const res = await createApp("/myapp.php").request(
      "https://example.com/myapp.php?foo=1&bar=2",
      {
        method: "POST",
        headers: { "x-twilio-signature": "L/OH5YylLD5NRKLltdqwSvS0BnU=" },
        body: new URLSearchParams({
          CallSid: "CA1234567890ABCDE",
          Caller: "+14158675310",
          Digits: "1234",
          From: "+14158675310",
          To: "+18005551212",
        }),
      },
      { TWILIO_AUTH_TOKEN: "12345" } as unknown as CloudflareBindings,
    );
    expect(res.status).toBe(200);
  });

  it("TWILIO_AUTH_TOKEN が空の場合は 500 になり検証をすり抜けない", async () => {
    const res = await createApp().request(
      HOOK_URL,
      {
        method: "POST",
        headers: { "x-twilio-signature": signRequest(HOOK_URL, {}, "") },
      },
      { TWILIO_AUTH_TOKEN: "" } as unknown as CloudflareBindings,
    );
    expect(res.status).toBe(500);
  });
});

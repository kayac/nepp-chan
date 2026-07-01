import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";
import { base64UrlToString } from "~/lib/crypto";
import { verifyRelayToken } from "~/services/voice/twilio-token";
import { twilioVoiceRoutes } from "./voice";

const env = {
  TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
  TWILIO_API_KEY_SID: "SK00000000000000000000000000000000",
  TWILIO_API_KEY_SECRET: "api-secret",
  TWILIO_TWIML_APP_SID: "AP00000000000000000000000000000000",
  CALL_TOKEN_SECRET: "call-token-secret",
} as unknown as CloudflareBindings;

const buildApp = () => {
  const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
  app.route("/twilio/voice", twilioVoiceRoutes);
  return app;
};

describe("POST /twilio/voice/token", () => {
  it("softphone 用 AccessToken（JWT）と identity を返す", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/token",
      { method: "POST" },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; identity: string };
    expect(body.token.split(".")).toHaveLength(3);
    expect(body.identity).toMatch(/^dev-/);

    const header = JSON.parse(base64UrlToString(body.token.split(".")[0]));
    expect(header.cty).toBe("twilio-fpa;v=1");
  });
});

describe("POST /twilio/voice/incoming", () => {
  it("ConversationRelay の TwiML（text/xml）を返す", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/incoming",
      { method: "POST" },
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("xml");

    const xml = await res.text();
    expect(xml).toContain("<Connect><ConversationRelay");
    expect(xml).toContain('language="ja-JP"');
    expect(xml).toContain('ttsProvider="Google"');
    expect(xml).toContain('voice="ja-JP-Chirp3-HD-Leda"');
    expect(xml).toContain("もしもし、ねっぷちゃんだよ。");
    expect(xml).toContain('hints="音威子府,おといねっぷ"');
  });

  it("リクエストの host から wss の relay URL を組み立てる", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/incoming",
      { method: "POST" },
      env,
    );
    const xml = await res.text();
    expect(xml).toContain("wss://api.example.com/twilio/voice/relay?token=");
  });

  it("relay URL のトークンは CALL_TOKEN_SECRET で検証できる", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/incoming",
      { method: "POST" },
      env,
    );
    const xml = await res.text();
    const token = xml.match(/relay\?token=([^"]+)"/)?.[1];
    expect(token).toBeTruthy();
    const claims = await verifyRelayToken(
      token as string,
      env.CALL_TOKEN_SECRET,
      {
        nowSeconds: Math.floor(Date.now() / 1000),
      },
    );
    expect(claims).not.toBeNull();
  });

  it("固定の STT/endpointing 設定を TwiML に出力する", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/incoming",
      { method: "POST" },
      env,
    );
    const xml = await res.text();
    expect(xml).toContain('transcriptionProvider="Google"');
    expect(xml).toContain('speechModel="long"');
    expect(xml).toContain('speechTimeout="700"');
    expect(xml).not.toContain("partialPrompts");
  });
});

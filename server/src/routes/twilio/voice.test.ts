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
    expect(xml).toContain('ttsProvider="ElevenLabs"');
    expect(xml).toContain('voice="8EkOjt4xTPGMclNlh1pk-flash_v2_5"');
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
    expect(xml).toContain('url="wss://api.example.com/twilio/voice/relay"');
  });

  it("relay トークンは CALL_TOKEN_SECRET で検証できる", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/incoming",
      { method: "POST" },
      env,
    );
    const xml = await res.text();
    const token = xml.match(/<Parameter name="token" value="([^"]+)"/)?.[1];
    expect(token).toBeTruthy();
    const claims = await verifyRelayToken(
      token as string,
      env.CALL_TOKEN_SECRET,
    );
    expect(claims).not.toBeNull();
  });

  it("voicePreset パラメータで TTS プリセットを切り替える", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/incoming",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ voicePreset: "leda" }),
      },
      env,
    );
    const xml = await res.text();
    expect(xml).toContain('ttsProvider="Google"');
    expect(xml).toContain('voice="ja-JP-Chirp3-HD-Leda"');
  });

  it("未知の voicePreset は既定プリセットにフォールバックする", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/incoming",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ voicePreset: "unknown-voice" }),
      },
      env,
    );
    const xml = await res.text();
    expect(xml).toContain('ttsProvider="ElevenLabs"');
    expect(xml).toContain('voice="8EkOjt4xTPGMclNlh1pk-flash_v2_5"');
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
    expect(xml).toContain('speechTimeout="600"');
    expect(xml).toContain('partialPrompts="true"');
  });
  it("チューニングパラメータを TwiML 属性に反映する", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/incoming",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          transcriptionProvider: "Deepgram",
          speechModel: "nova-2-general",
          eotThreshold: "0.7",
          interruptSensitivity: "low",
          welcomeGreeting: "やあ",
          deepgramSmartFormat: "false",
        }),
      },
      env,
    );
    const xml = await res.text();
    expect(xml).toContain('transcriptionProvider="Deepgram"');
    expect(xml).toContain('speechModel="nova-2-general"');
    expect(xml).toContain('eotThreshold="0.7"');
    expect(xml).toContain('interruptSensitivity="low"');
    expect(xml).toContain('welcomeGreeting="やあ"');
    expect(xml).toContain('deepgramSmartFormat="false"');
  });

  it("不正なチューニング値は既定値へフォールバックし通話を落とさない", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/incoming",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          speechTimeout: "100",
          voice: '"><Say>hacked</Say>',
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('speechTimeout="600"');
    expect(xml).toContain('voice="8EkOjt4xTPGMclNlh1pk-flash_v2_5"');
    expect(xml).not.toContain("<Say>");
  });

  it("サーバ側ノブを <Parameter> として出力し token と共存させる", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/incoming",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          fillerEnabled: "false",
          aizuchiCooldownMs: "4000",
        }),
      },
      env,
    );
    const xml = await res.text();
    expect(xml).toMatch(/<Parameter name="token" value="[^"]+"\/>/);
    expect(xml).toContain('<Parameter name="fillerEnabled" value="false"/>');
    expect(xml).toContain('<Parameter name="aizuchiCooldownMs" value="4000"/>');
  });
});

describe("GET /twilio/voice/presets", () => {
  it("プリセット一覧を返す", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/presets",
      { method: "GET" },
      env,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      presets: { id: string; label: string }[];
    };
    expect(json.presets.map((p) => p.id)).toContain("leda");
    expect(json.presets.every((p) => p.label.length > 0)).toBe(true);
  });

  it("プリセットの ttsProvider/voice と全チューニング既定値を返す", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/presets",
      { method: "GET" },
      env,
    );
    const json = (await res.json()) as {
      presets: { id: string; ttsProvider: string; voice: string }[];
      defaults: Record<string, string>;
    };
    const leda = json.presets.find((p) => p.id === "leda");
    expect(leda?.ttsProvider).toBe("Google");
    expect(leda?.voice).toBe("ja-JP-Chirp3-HD-Leda");
    expect(json.defaults.speechTimeout).toBe("600");
    expect(json.defaults.interruptible).toBe("speech");
    expect(json.defaults.fillerEnabled).toBe("true");
    expect(json.defaults.aizuchiCooldownMs).toBe("2000");
  });
});

import { createHmac } from "node:crypto";
import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: { findValid: vi.fn() },
}));
vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: { findById: vi.fn() },
}));
vi.mock("~/services/auth/anonymous-session", () => ({
  verifyAnonymousToken: vi.fn(),
}));

const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { verifyAnonymousToken } = await import(
  "~/services/auth/anonymous-session"
);
const { base64UrlToString } = await import("~/lib/crypto");
const { verifyRelayToken } = await import("~/services/voice/twilio-token");
const { twilioVoiceRoutes } = await import("./voice");
const { withResolvePrincipal } = await import("~/__tests__/helpers/test-app");

const parent = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
parent.route("/twilio/voice", twilioVoiceRoutes);
const app = await withResolvePrincipal(parent);

const env = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
  TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
  TWILIO_API_KEY_SID: "SK00000000000000000000000000000000",
  TWILIO_API_KEY_SECRET: "api-secret",
  TWILIO_TWIML_APP_SID: "AP00000000000000000000000000000000",
  TWILIO_AUTH_TOKEN: "twilio-auth-token",
  CALL_TOKEN_SECRET: "call-token-secret",
} as unknown as CloudflareBindings;

const buildApp = () => app;

const INCOMING_URL = "http://api.example.com/twilio/voice/incoming";

const signTwilio = (url: string, params: Record<string, string> = {}) =>
  createHmac("sha1", "twilio-auth-token")
    .update(
      url +
        Object.keys(params)
          .sort()
          .map((name) => name + params[name])
          .join(""),
    )
    .digest("base64");

const postIncoming = (params?: Record<string, string>) =>
  buildApp().request(
    INCOMING_URL,
    {
      method: "POST",
      headers: { "x-twilio-signature": signTwilio(INCOMING_URL, params) },
      ...(params ? { body: new URLSearchParams(params) } : {}),
    },
    env,
  );

const ADMIN_TOKEN = "a".repeat(64);

const useAdminAuth = (role: "staff" | "admin" | "super_admin" = "staff") => {
  vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
    token: ADMIN_TOKEN,
    userId: "u-1",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  });
  vi.mocked(adminUserRepository.findById).mockResolvedValue({
    id: "u-1",
    username: "staff01",
    name: "スタッフ",
    role,
    passwordHash: "hash",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: null,
  });
};

beforeEach(() => {
  vi.mocked(adminSessionRepository.findValid).mockReset();
  vi.mocked(adminUserRepository.findById).mockReset();
  vi.mocked(verifyAnonymousToken).mockReset();
});

describe("POST /twilio/voice/token", () => {
  it("未認証は 401 でトークンを発行しない", async () => {
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/token",
      { method: "POST" },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("anonymous JWT は 403 でトークンを発行しない", async () => {
    vi.mocked(verifyAnonymousToken).mockResolvedValue("anon-resource");
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/token",
      {
        method: "POST",
        headers: { Authorization: "Bearer anon-jwt" },
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("staff 管理者に softphone 用 AccessToken（JWT）と identity を返す", async () => {
    useAdminAuth("staff");
    const res = await buildApp().request(
      "http://api.example.com/twilio/voice/token",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      },
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
  it("X-Twilio-Signature ヘッダーがないリクエストは 401 で TwiML を返さない", async () => {
    const res = await buildApp().request(INCOMING_URL, { method: "POST" }, env);
    expect(res.status).toBe(401);
  });

  it("不正な署名のリクエストは 401 で TwiML を返さない", async () => {
    const res = await buildApp().request(
      INCOMING_URL,
      {
        method: "POST",
        headers: { "x-twilio-signature": "invalid-signature" },
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("ConversationRelay の TwiML（text/xml）を返す", async () => {
    const res = await postIncoming();
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
    const res = await postIncoming();
    const xml = await res.text();
    expect(xml).toContain('url="wss://api.example.com/twilio/voice/relay"');
  });

  it("relay トークンは CALL_TOKEN_SECRET で検証できる", async () => {
    const res = await postIncoming();
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
    const res = await postIncoming({ voicePreset: "leda" });
    const xml = await res.text();
    expect(xml).toContain('ttsProvider="Google"');
    expect(xml).toContain('voice="ja-JP-Chirp3-HD-Leda"');
  });

  it("未知の voicePreset は既定プリセットにフォールバックする", async () => {
    const res = await postIncoming({ voicePreset: "unknown-voice" });
    const xml = await res.text();
    expect(xml).toContain('ttsProvider="ElevenLabs"');
    expect(xml).toContain('voice="8EkOjt4xTPGMclNlh1pk-flash_v2_5"');
  });

  it("固定の STT/endpointing 設定を TwiML に出力する", async () => {
    const res = await postIncoming();
    const xml = await res.text();
    expect(xml).toContain('transcriptionProvider="Google"');
    expect(xml).toContain('speechModel="long"');
    expect(xml).toContain('speechTimeout="600"');
    expect(xml).toContain('partialPrompts="true"');
    expect(xml).toContain('reportInputDuringAgentSpeech="any"');
    expect(xml).toContain('ignoreBackchannel="true"');
  });
  it("チューニングパラメータを TwiML 属性に反映する", async () => {
    const res = await postIncoming({
      transcriptionProvider: "Deepgram",
      speechModel: "nova-2-general",
      eotThreshold: "0.7",
      interruptSensitivity: "low",
      welcomeGreeting: "やあ",
      deepgramSmartFormat: "false",
    });
    const xml = await res.text();
    expect(xml).toContain('transcriptionProvider="Deepgram"');
    expect(xml).toContain('speechModel="nova-2-general"');
    expect(xml).toContain('eotThreshold="0.7"');
    expect(xml).toContain('interruptSensitivity="low"');
    expect(xml).toContain('welcomeGreeting="やあ"');
    expect(xml).toContain('deepgramSmartFormat="false"');
  });

  it("不正なチューニング値は既定値へフォールバックし通話を落とさない", async () => {
    const res = await postIncoming({
      speechTimeout: "100",
      voice: '"><Say>hacked</Say>',
    });
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('speechTimeout="600"');
    expect(xml).toContain('voice="8EkOjt4xTPGMclNlh1pk-flash_v2_5"');
    expect(xml).not.toContain("<Say>");
  });

  it("サーバ側ノブを <Parameter> として出力し token と共存させる", async () => {
    const res = await postIncoming({
      fillerEnabled: "false",
      aizuchiCooldownMs: "4000",
    });
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

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { generateId } from "~/lib/crypto";
import {
  createRelayToken,
  createVoiceAccessToken,
} from "~/services/voice/twilio-token";
import { buildConversationRelayTwiml } from "~/services/voice/twiml";

export const twilioVoiceRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const ACCESS_TOKEN_TTL_SECONDS = 3600;
const RELAY_TOKEN_TTL_SECONDS = 300;
// 通話モックの固定設定。STT の Google は既定 telephony が ja-JP 非対応で弾かれるため long を明示。
const VOICE_CONFIG = {
  welcomeGreeting: "もしもし、ねっぷちゃんだよ。なんでも聞いてね。",
  transcriptionProvider: "Google",
  speechModel: "long",
  speechTimeout: "700",
  hints: "音威子府,おといねっぷ",
  interruptible: "speech",
} as const;

// voice の書式: voiceId[-model][-speed_stability_similarity]
const VOICE_PRESETS = {
  morioki: {
    label: "Morioki",
    ttsProvider: "ElevenLabs",
    voice: "8EkOjt4xTPGMclNlh1pk-flash_v2_5",
  },
  hina: {
    label: "Hina",
    ttsProvider: "ElevenLabs",
    voice: "lhTvHflPVOqgSWyuWQry-flash_v2_5",
  },
  yui: {
    label: "Yui",
    ttsProvider: "ElevenLabs",
    voice: "fUjY9K2nAIwlALOwSiwc-flash_v2_5",
  },
  mitsuki: {
    label: "Mitsuki",
    ttsProvider: "ElevenLabs",
    voice: "gARvXPexe5VF3cKZBian-flash_v2_5",
  },
  leda: {
    label: "Leda（Google）",
    ttsProvider: "Google",
    voice: "ja-JP-Chirp3-HD-Leda",
  },
} as const satisfies Record<
  string,
  { label: string; ttsProvider: string; voice: string }
>;

type VoicePresetId = keyof typeof VOICE_PRESETS;

const DEFAULT_VOICE_PRESET: VoicePresetId = "morioki";

const resolveVoicePresetId = (value: unknown) =>
  typeof value === "string" && value in VOICE_PRESETS
    ? (value as VoicePresetId)
    : DEFAULT_VOICE_PRESET;

const nowSeconds = () => Math.floor(Date.now() / 1000);

const tokenRoute = createRoute({
  method: "post",
  path: "/token",
  summary: "通話用 AccessToken 発行",
  tags: ["Twilio"],
  responses: {
    200: {
      description: "softphone（@twilio/voice-sdk）用の Twilio AccessToken",
      content: {
        "application/json": {
          schema: z.object({ token: z.string(), identity: z.string() }),
        },
      },
    },
  },
});

twilioVoiceRoutes.openapi(tokenRoute, async (c) => {
  const identity = `dev-${generateId()}`;
  const token = await createVoiceAccessToken({
    accountSid: c.env.TWILIO_ACCOUNT_SID,
    apiKeySid: c.env.TWILIO_API_KEY_SID,
    apiKeySecret: c.env.TWILIO_API_KEY_SECRET,
    twimlAppSid: c.env.TWILIO_TWIML_APP_SID,
    identity,
    nowSeconds: nowSeconds(),
    ttlSeconds: ACCESS_TOKEN_TTL_SECONDS,
  });
  return c.json({ token, identity }, 200);
});

const presetsRoute = createRoute({
  method: "get",
  path: "/presets",
  summary: "通話ボイスプリセット一覧",
  tags: ["Twilio"],
  responses: {
    200: {
      description: "/call-dev の切り替え UI 用のボイスプリセット",
      content: {
        "application/json": {
          schema: z.object({
            defaultId: z.string(),
            presets: z.array(z.object({ id: z.string(), label: z.string() })),
          }),
        },
      },
    },
  },
});

twilioVoiceRoutes.openapi(presetsRoute, (c) =>
  c.json(
    {
      defaultId: DEFAULT_VOICE_PRESET,
      presets: Object.entries(VOICE_PRESETS).map(([id, { label }]) => ({
        id,
        label,
      })),
    },
    200,
  ),
);

twilioVoiceRoutes.post("/incoming", async (c) => {
  const [relayToken, requestedPreset] = await Promise.all([
    createRelayToken(c.env.CALL_TOKEN_SECRET, {
      nowSeconds: nowSeconds(),
      ttlSeconds: RELAY_TOKEN_TTL_SECONDS,
    }),
    // body なし（form-encoded 以外）でも既定プリセットで TwiML を返す。
    c.req
      .parseBody()
      .then((body) => body.voicePreset)
      .catch(() => undefined),
  ]);
  const host = new URL(c.req.url).host;
  const wsUrl = `wss://${host}/twilio/voice/relay`;

  const { ttsProvider, voice } =
    VOICE_PRESETS[resolveVoicePresetId(requestedPreset)];

  const xml = buildConversationRelayTwiml({
    wsUrl,
    ...VOICE_CONFIG,
    ttsProvider,
    voice,
    parameters: { token: relayToken },
  });

  return c.body(xml, 200, { "Content-Type": "text/xml; charset=utf-8" });
});

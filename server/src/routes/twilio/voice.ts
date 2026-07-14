import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { generateId } from "~/lib/crypto";
import { logger } from "~/lib/logger";
import { serializeBridgeConfig } from "~/services/voice/bridge-config";
import {
  parseVoiceTuning,
  VOICE_PRESETS,
  VOICE_TUNING_DEFAULTS,
} from "~/services/voice/tuning";
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
  summary: "通話ボイスプリセットとチューニング既定値",
  tags: ["Twilio"],
  responses: {
    200: {
      description: "/call-dev のチューニング UI 用のプリセットと既定値",
      content: {
        "application/json": {
          schema: z.object({
            presets: z.array(
              z.object({
                id: z.string(),
                label: z.string(),
                ttsProvider: z.string(),
                voice: z.string(),
              }),
            ),
            defaults: z.record(z.string(), z.string()),
          }),
        },
      },
    },
  },
});

twilioVoiceRoutes.openapi(presetsRoute, (c) =>
  c.json(
    {
      presets: Object.entries(VOICE_PRESETS).map(
        ([id, { label, ttsProvider, voice }]) => ({
          id,
          label,
          ttsProvider,
          voice,
        }),
      ),
      defaults: VOICE_TUNING_DEFAULTS,
    },
    200,
  ),
);

twilioVoiceRoutes.post("/incoming", async (c) => {
  const [relayToken, body] = await Promise.all([
    createRelayToken(c.env.CALL_TOKEN_SECRET, {
      nowSeconds: nowSeconds(),
      ttlSeconds: RELAY_TOKEN_TTL_SECONDS,
    }),
    // body なし（form-encoded 以外）でも既定設定で TwiML を返す。
    c.req.parseBody().catch(() => ({}) as Record<string, unknown>),
  ]);
  const host = new URL(c.req.url).host;
  const wsUrl = `wss://${host}/twilio/voice/relay`;

  const { relay, bridge, invalidKeys } = parseVoiceTuning(body);
  if (invalidKeys.length > 0) {
    logger.warn("[Voice] invalid tuning params, fell back to defaults", {
      keys: invalidKeys.join(","),
    });
  }

  const xml = buildConversationRelayTwiml({
    wsUrl,
    ...relay,
    parameters: { token: relayToken, ...serializeBridgeConfig(bridge) },
  });

  return c.body(xml, 200, { "Content-Type": "text/xml; charset=utf-8" });
});

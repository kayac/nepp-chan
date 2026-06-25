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
const WELCOME_GREETING = "もしもし、ねっぷちゃんだよ。なんでも聞いてね。";

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

twilioVoiceRoutes.post("/incoming", async (c) => {
  const relayToken = await createRelayToken(c.env.CALL_TOKEN_SECRET, {
    nowSeconds: nowSeconds(),
    ttlSeconds: RELAY_TOKEN_TTL_SECONDS,
  });
  const host = new URL(c.req.url).host;
  const wsUrl = `wss://${host}/twilio/voice/relay?token=${relayToken}`;

  const xml = buildConversationRelayTwiml({
    wsUrl,
    welcomeGreeting: WELCOME_GREETING,
    ttsProvider: c.env.VOICE_TTS_PROVIDER || undefined,
    voice: c.env.VOICE_TTS_VOICE || undefined,
    interruptible: "speech",
  });

  return c.body(xml, 200, { "Content-Type": "text/xml; charset=utf-8" });
});

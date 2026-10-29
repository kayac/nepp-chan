import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { logger } from "~/lib/logger";
import { errorResponse } from "~/lib/openapi-errors";
import { elevenlabsToolSecretVerify } from "~/middleware/elevenlabs-tool-secret";
import { requireRole } from "~/middleware/require-role";
import { handlePostCallEvent } from "~/services/voice/elevenlabs/post-call";
import { runResearch } from "~/services/voice/elevenlabs/research";
import { verifyWebhookSignature } from "~/services/voice/elevenlabs/webhook-signature";

export const elevenlabsVoiceRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const signedUrlRoute = createRoute({
  method: "post",
  path: "/signed-url",
  summary: "【管理者専用】ElevenLabs 会話用の署名付き URL 発行",
  tags: ["ElevenLabs"],
  middleware: [requireRole("staff")] as const,
  responses: {
    200: {
      description: "ブラウザから ElevenLabs Agent に接続するための signed URL",
      content: {
        "application/json": {
          schema: z.object({ signedUrl: z.string() }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    500: errorResponse(500),
  },
});

elevenlabsVoiceRoutes.openapi(signedUrlRoute, async (c) => {
  const url = new URL(
    "/v1/convai/conversation/get-signed-url",
    "https://api.elevenlabs.io",
  );
  url.searchParams.set("agent_id", c.env.ELEVENLABS_AGENT_ID);
  const res = await fetch(url, {
    headers: { "xi-api-key": c.env.ELEVENLABS_API_KEY },
  });
  if (!res.ok) {
    logger.error("[Voice][EL] signed url failed", undefined, {
      status: res.status,
      body: await res.text(),
    });
    throw new HTTPException(500, { message: "署名付き URL を取得できません" });
  }
  const { signed_url } = (await res.json()) as { signed_url: string };
  return c.json({ signedUrl: signed_url }, 200);
});

const researchBodySchema = z.object({ question: z.string().min(1) });

elevenlabsVoiceRoutes.post(
  "/research",
  elevenlabsToolSecretVerify,
  async (c) => {
    const { question } = researchBodySchema.parse(await c.req.json());
    const answer = await runResearch({ env: c.env, question });
    return c.json({ answer }, 200);
  },
);

elevenlabsVoiceRoutes.post("/post-call", async (c) => {
  const body = await c.req.text();
  const valid = await verifyWebhookSignature({
    header: c.req.header("elevenlabs-signature"),
    body,
    secret: c.env.ELEVENLABS_WEBHOOK_SECRET,
  });
  if (!valid) {
    logger.warn("[Voice][EL] invalid webhook signature");
    throw new HTTPException(401, { message: "Invalid signature" });
  }
  const result = await handlePostCallEvent({
    env: c.env,
    event: JSON.parse(body),
  });
  return c.json(result, 200);
});

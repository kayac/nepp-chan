#!/usr/bin/env tsx
/**
 * ElevenLabs に research ツールと ねっぷちゃん agent を作成する。
 *
 * 使用方法:
 *   pnpm elevenlabs:setup <公開 API ベース URL> [--tool-id=tool_xxx] [--webhook-id=xxx] [--voice-id=xxx]
 *
 * 例:
 *   pnpm elevenlabs:setup https://el-local.nepp-chan.ai
 *
 * ELEVENLABS_API_KEY / ELEVENLABS_TOOL_SECRET は server/.dev.vars から読む。
 * 作成した agent_id は .dev.vars の ELEVENLABS_AGENT_ID に書き戻す。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getPlatformProxy } from "wrangler";
import { buildElevenLabsPrompt } from "./elevenlabs-prompt";

const REALTIME_MODEL = "eleven_realtime_v1_max";
const DEFAULT_VOICE_ID = "8EkOjt4xTPGMclNlh1pk";
const DEV_VARS_PATH = ".dev.vars";

const parseArgs = (args: string[]) => {
  const option = (name: string) =>
    args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  return {
    baseUrl: args.find((a) => !a.startsWith("--")),
    toolId: option("tool-id"),
    webhookId: option("webhook-id"),
    voiceId: option("voice-id") ?? DEFAULT_VOICE_ID,
  };
};

const createResearchTool = (
  client: ElevenLabsClient,
  baseUrl: string,
  toolSecret: string,
) =>
  client.conversationalAi.tools.create({
    toolConfig: {
      type: "webhook",
      name: "research",
      description:
        "店・施設・イベント・交通・天気・歴史・行政手続きなど、村と世の中の事実を調べます。ねっぷちゃんはこれらを記憶していないので、事実を口にする前に必ず呼びます。",
      apiSchema: {
        url: `${baseUrl}/elevenlabs/voice/research`,
        method: "POST",
        requestHeaders: { "x-nepp-tool-secret": toolSecret },
        requestBodySchema: {
          type: "object",
          required: ["question", "aspects"],
          properties: {
            question: {
              type: "string",
              description:
                "ユーザーが知りたいこと。会話の流れをふまえた具体的な問い",
            },
            aspects: {
              type: "array",
              description:
                "答えに要る観点だけ。1 つで足りる質問は 1 つ、多くても 5 つ。念のための観点は足さない",
              items: {
                type: "object",
                required: ["topic", "queries"],
                properties: {
                  topic: {
                    type: "string",
                    description:
                      "調べる観点。手続き・制度・施設・日程など、答えに必要な要素 1 つ",
                  },
                  queries: {
                    type: "array",
                    description:
                      "その観点を村の資料から探す検索語。1〜3 個。資料に出てきそうな制度名・施設名・手続き名で書く。ユーザーが略称で言ったら略称と正式名称の両方を入れる（国保 と 国民健康保険）。年度は資料どおり令和表記のまま",
                    items: { type: "string", description: "検索語 1 つ" },
                  },
                },
              },
            },
          },
        },
      },
      responseTimeoutSecs: 120,
      preToolSpeech: "force",
      executionMode: "immediate",
      interruptionMode: "disable_during_tool",
      toolCallSound: "typing",
      toolCallSoundBehavior: "always",
    },
  });

const createAgent = (
  client: ElevenLabsClient,
  {
    toolId,
    voiceId,
    webhookId,
  }: { toolId: string; voiceId: string; webhookId?: string },
) =>
  client.conversationalAi.agents.create({
    name: "ねっぷちゃん spike",
    conversationConfig: {
      agent: {
        firstMessage: "もしもし、ねっぷちゃんだよ。どうしたの？",
        language: "ja",
        prompt: {
          prompt: buildElevenLabsPrompt(),
          timezone: "Asia/Tokyo",
          toolIds: [toolId],
          builtInTools: {
            endCall: {
              name: "end_call",
              params: { systemToolType: "end_call" },
            },
          },
          cascadeTimeoutSeconds: 15,
        },
      },
      tts: { voiceId, modelId: "eleven_flash_v2_5" },
      turn: { turnEagerness: "eager", turnTimeout: 20 },
    },
    ...(webhookId
      ? {
          platformSettings: {
            workspaceOverrides: {
              webhooks: {
                postCallWebhookId: webhookId,
                events: ["transcript"],
              },
            },
          },
        }
      : {}),
  });

// SDK 2.75 のリクエスト型に realtime_model が無く、未知キーは送信前に落とされるため生 API で設定する
const enableRealtimeMode = async (apiKey: string, agentId: string) => {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
    {
      method: "PATCH",
      headers: { "xi-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        conversation_config: { realtime_model: REALTIME_MODEL },
      }),
    },
  );
  return res.ok ? "realtime" : `custom (${await res.text()})`;
};

const writeAgentId = (agentId: string) => {
  const vars = readFileSync(DEV_VARS_PATH, "utf8");
  const line = `ELEVENLABS_AGENT_ID=${agentId}`;
  writeFileSync(
    DEV_VARS_PATH,
    vars.includes("ELEVENLABS_AGENT_ID=")
      ? vars.replace(/^ELEVENLABS_AGENT_ID=.*$/m, line)
      : `${vars.trimEnd()}\n${line}\n`,
  );
};

const main = async () => {
  const { baseUrl, toolId, webhookId, voiceId } = parseArgs(
    process.argv.slice(2),
  );
  if (!baseUrl) {
    console.error(
      "usage: pnpm elevenlabs:setup <公開 API ベース URL> [--tool-id=] [--webhook-id=] [--voice-id=]",
    );
    process.exit(1);
  }
  const { env, dispose } = await getPlatformProxy<CloudflareBindings>({
    configPath: "wrangler.jsonc",
  });
  try {
    const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
    const resolvedToolId =
      toolId ??
      (await createResearchTool(client, baseUrl, env.ELEVENLABS_TOOL_SECRET))
        .id;
    console.log(`tool_id=${resolvedToolId}`);

    const { agentId } = await createAgent(client, {
      toolId: resolvedToolId,
      voiceId,
      webhookId,
    });
    const mode = await enableRealtimeMode(env.ELEVENLABS_API_KEY, agentId);
    console.log(`agent_id=${agentId} (${mode})`);

    writeAgentId(agentId);
    console.log(`ELEVENLABS_AGENT_ID を ${DEV_VARS_PATH} に書きました`);
  } finally {
    await dispose();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

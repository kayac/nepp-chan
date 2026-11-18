import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";

export const promptSettings = { timezone: "Asia/Tokyo", temperature: 0.6 };

export const turnConfig: ElevenLabs.TurnConfig = {
  turnEagerness: "eager",
  turnTimeout: 20,
  speculativeTurn: true,
  transcribeOnDisabledInterruptions: true,
  interruptionIgnoreTermLanguages: ["ja"],
};

export const researchToolConfig = ({
  url,
  toolSecret,
}: {
  url: string;
  toolSecret: string;
}): ElevenLabs.ToolRequestModelToolConfig => ({
  type: "webhook",
  name: "research",
  description:
    "店・施設・イベント・交通・天気・歴史・行政手続きなど、村と世の中の事実を調べます。ねっぷちゃんはこれらを記憶していないので、事実を口にする前に必ず呼びます。",
  apiSchema: {
    url,
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
  interruptionMode: "disable_during_tool_and_turn",
  toolCallSound: "typing",
  toolCallSoundBehavior: "always",
});

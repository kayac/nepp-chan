import { z } from "zod";
import {
  BRIDGE_CONFIG_DEFAULTS,
  boolParam,
  bridgeFieldSchemas,
  collectTuningParams,
  serializeBridgeConfig,
} from "./bridge-config";

// voice の書式: voiceId[-model][-speed_stability_similarity]
export const VOICE_PRESETS = {
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

export type VoicePresetId = keyof typeof VOICE_PRESETS;

export const DEFAULT_VOICE_PRESET: VoicePresetId = "morioki";

const interruptionSchema = z.enum(["none", "dtmf", "speech", "any"]);

export const relayFieldSchemas = {
  ttsProvider: z.enum(["Google", "Amazon", "ElevenLabs"]),
  voice: z.string().regex(/^[A-Za-z0-9._-]{1,120}$/),
  language: z.string().regex(/^[A-Za-z][A-Za-z0-9-]{1,15}$/),
  ttsLanguage: z.string().regex(/^[A-Za-z][A-Za-z0-9-]{1,15}$/),
  transcriptionLanguage: z.string().regex(/^[A-Za-z][A-Za-z0-9-]{1,15}$/),
  // 制御文字は XML 属性値として不正で Twilio がドキュメントエラーにするため拒否する。
  welcomeGreeting: z
    .string()
    .max(200)
    .regex(/^\P{Cc}*$/u),
  welcomeGreetingInterruptible: interruptionSchema,
  transcriptionProvider: z.enum(["Google", "Deepgram"]),
  speechModel: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
  speechTimeout: z.union([
    z.literal("auto"),
    z.coerce.number().int().min(600).max(5_000).transform(String),
  ]),
  eotThreshold: z.coerce.number().min(0.5).max(0.9).transform(String),
  partialPrompts: boolParam,
  deepgramSmartFormat: boolParam,
  interruptible: interruptionSchema,
  interruptSensitivity: z.enum(["high", "medium", "low"]),
  dtmfDetection: boolParam,
  reportInputDuringAgentSpeech: interruptionSchema,
  ignoreBackchannel: boolParam,
  preemptible: boolParam,
  hints: z
    .string()
    .max(500)
    .regex(/^\P{Cc}*$/u),
  elevenlabsTextNormalization: z.enum(["on", "auto", "off"]),
  debug: z.string().regex(/^[a-z][a-z -]{0,99}$/),
} satisfies Record<string, z.ZodType>;

// Twilio 既定の telephony が ja-JP 非対応で弾かれるため speechModel は long を明示。
// speechTimeout は "auto" または 600〜5000 の範囲でなければならない（600未満はエラー64101）。
const RELAY_TUNING_DEFAULTS = {
  welcomeGreeting: "もしもし、ねっぷちゃんだよ。なんでも聞いてね。",
  language: "ja-JP",
  transcriptionProvider: "Google",
  speechModel: "long",
  speechTimeout: "600",
  hints: "音威子府,おといねっぷ",
  interruptible: "speech",
  partialPrompts: true,
} as const;

const resolveVoicePresetId = (value: unknown) =>
  typeof value === "string" && value in VOICE_PRESETS
    ? (value as VoicePresetId)
    : undefined;

export const parseVoiceTuning = (body: Record<string, unknown>) => {
  const invalidKeys: string[] = [];

  const presetId = resolveVoicePresetId(body.voicePreset);
  if ("voicePreset" in body && presetId === undefined) {
    invalidKeys.push("voicePreset");
  }
  const preset = VOICE_PRESETS[presetId ?? DEFAULT_VOICE_PRESET];

  const relayResult = collectTuningParams(relayFieldSchemas, body);
  const bridgeResult = collectTuningParams(bridgeFieldSchemas, body);
  invalidKeys.push(...relayResult.invalidKeys, ...bridgeResult.invalidKeys);

  return {
    relay: {
      ...RELAY_TUNING_DEFAULTS,
      ttsProvider: preset.ttsProvider,
      voice: preset.voice,
      ...relayResult.values,
    },
    bridge: { ...BRIDGE_CONFIG_DEFAULTS, ...bridgeResult.values },
    invalidKeys,
  };
};

export type VoiceRelayTuning = ReturnType<typeof parseVoiceTuning>["relay"];

// Twilio 側既定値のうち UI が初期表示に使うもの。差分送信の基準にもなる。
const TWILIO_DEFAULTS = {
  ttsLanguage: "",
  transcriptionLanguage: "",
  welcomeGreetingInterruptible: "any",
  eotThreshold: "0.8",
  deepgramSmartFormat: "true",
  interruptSensitivity: "high",
  dtmfDetection: "false",
  reportInputDuringAgentSpeech: "none",
  ignoreBackchannel: "false",
  preemptible: "false",
  elevenlabsTextNormalization: "off",
  debug: "",
} as const;

export const VOICE_TUNING_DEFAULTS: Record<string, string> = {
  voicePreset: DEFAULT_VOICE_PRESET,
  ttsProvider: VOICE_PRESETS[DEFAULT_VOICE_PRESET].ttsProvider,
  voice: VOICE_PRESETS[DEFAULT_VOICE_PRESET].voice,
  welcomeGreeting: RELAY_TUNING_DEFAULTS.welcomeGreeting,
  language: RELAY_TUNING_DEFAULTS.language,
  transcriptionProvider: RELAY_TUNING_DEFAULTS.transcriptionProvider,
  speechModel: RELAY_TUNING_DEFAULTS.speechModel,
  speechTimeout: RELAY_TUNING_DEFAULTS.speechTimeout,
  hints: RELAY_TUNING_DEFAULTS.hints,
  interruptible: RELAY_TUNING_DEFAULTS.interruptible,
  partialPrompts: String(RELAY_TUNING_DEFAULTS.partialPrompts),
  ...TWILIO_DEFAULTS,
  ...serializeBridgeConfig(BRIDGE_CONFIG_DEFAULTS),
};

import { z } from "zod";
import { AIZUCHI_PHRASES } from "./aizuchi";
import { BACKCHANNEL_FILLERS, THINKING_FILLERS } from "./filler";

export const boolParam = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

const phraseListParam = z
  .string()
  .max(200)
  .regex(/^\P{Cc}*$/u)
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .refine(
    (list) =>
      list.length >= 1 &&
      list.length <= 10 &&
      list.every((p) => p.length <= 20),
  );

export const collectTuningParams = <T extends Record<string, z.ZodType>>(
  fields: T,
  body: Record<string, unknown>,
) => {
  const values: Record<string, unknown> = {};
  const invalidKeys: string[] = [];
  for (const [key, schema] of Object.entries(fields)) {
    if (!(key in body)) continue;
    const result = schema.safeParse(body[key]);
    if (result.success) {
      values[key] = result.data;
    } else {
      invalidKeys.push(key);
    }
  }
  return {
    values: values as { [K in keyof T]?: z.infer<T[K]> },
    invalidKeys,
  };
};

export type BridgeConfig = {
  fillerEnabled: boolean;
  fillerDelayMs: number;
  thinkingFillers: string[];
  backchannelFillers: string[];
  aizuchiEnabled: boolean;
  aizuchiCooldownMs: number;
  aizuchiPhrases: string[];
  holdAudioEnabled: boolean;
  holdAudioUrl: string;
  holdDelayMs: number;
  endCallEnabled: boolean;
};

export const BRIDGE_CONFIG_DEFAULTS: BridgeConfig = {
  fillerEnabled: true,
  fillerDelayMs: 0,
  thinkingFillers: [...THINKING_FILLERS],
  backchannelFillers: [...BACKCHANNEL_FILLERS],
  aizuchiEnabled: true,
  aizuchiCooldownMs: 2_000,
  aizuchiPhrases: [...AIZUCHI_PHRASES],
  holdAudioEnabled: true,
  holdAudioUrl: "https://amachamusic.chagasi.com/mp3/tsukinokobune.mp3",
  holdDelayMs: 0,
  endCallEnabled: true,
};

const delayParam = z.coerce.number().int().min(0).max(5_000);

export const bridgeFieldSchemas = {
  fillerEnabled: boolParam,
  fillerDelayMs: delayParam,
  thinkingFillers: phraseListParam,
  backchannelFillers: phraseListParam,
  aizuchiEnabled: boolParam,
  aizuchiCooldownMs: z.coerce.number().int().min(500).max(30_000),
  aizuchiPhrases: phraseListParam,
  holdAudioEnabled: boolParam,
  holdAudioUrl: z
    .string()
    .max(300)
    .refine((v) => URL.canParse(v) && new URL(v).protocol === "https:"),
  holdDelayMs: delayParam,
  endCallEnabled: boolParam,
} satisfies Record<string, z.ZodType>;

export const parseBridgeConfig = (
  params?: Record<string, unknown>,
): BridgeConfig => {
  const { values } = collectTuningParams(bridgeFieldSchemas, params ?? {});
  return { ...BRIDGE_CONFIG_DEFAULTS, ...values };
};

export const serializeBridgeConfig = (config: BridgeConfig) => ({
  fillerEnabled: String(config.fillerEnabled),
  fillerDelayMs: String(config.fillerDelayMs),
  thinkingFillers: config.thinkingFillers.join(","),
  backchannelFillers: config.backchannelFillers.join(","),
  aizuchiEnabled: String(config.aizuchiEnabled),
  aizuchiCooldownMs: String(config.aizuchiCooldownMs),
  aizuchiPhrases: config.aizuchiPhrases.join(","),
  holdAudioEnabled: String(config.holdAudioEnabled),
  holdAudioUrl: config.holdAudioUrl,
  holdDelayMs: String(config.holdDelayMs),
  endCallEnabled: String(config.endCallEnabled),
});

export const TUNING_STORAGE_KEY = "call-dev-tuning:v1";

export type TuningValues = Record<string, string>;

type ElevenLabsVoiceParts = {
  voiceId: string;
  model?: string;
  speed?: string;
  stability?: string;
  similarity?: string;
};

export const buildElevenLabsVoice = ({
  voiceId,
  model,
  speed,
  stability,
  similarity,
}: ElevenLabsVoiceParts) => {
  const parts = [voiceId];
  if (model) parts.push(model);
  if (model && speed && stability && similarity) {
    parts.push(`${speed}_${stability}_${similarity}`);
  }
  return parts.join("-");
};

const VOICE_SETTINGS_RE = /^(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)$/;

export const parseElevenLabsVoice = (voice: string): ElevenLabsVoiceParts => {
  const [voiceId, ...rest] = voice.split("-");
  // 設定部は model を伴う場合のみ認識する（build 側と対称にし、往復で欠落させない）。
  const settings =
    rest.length >= 2 ? rest.at(-1)?.match(VOICE_SETTINGS_RE) : null;
  const modelSegments = settings ? rest.slice(0, -1) : rest;
  return {
    voiceId,
    ...(modelSegments.length > 0 && { model: modelSegments.join("-") }),
    ...(settings && {
      speed: settings[1],
      stability: settings[2],
      similarity: settings[3],
    }),
  };
};

export const toConnectParams = (values: TuningValues, defaults: TuningValues) =>
  Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => key in defaults && value !== defaults[key],
    ),
  );

export const saveTuning = (values: TuningValues) => {
  localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(values));
};

export const clearTuning = () => {
  localStorage.removeItem(TUNING_STORAGE_KEY);
};

export const loadStoredTuning = (defaults: TuningValues) => {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(TUNING_STORAGE_KEY) ?? "",
    );
    if (typeof stored !== "object" || stored === null) return { ...defaults };
    const entries = Object.entries(stored).filter(
      ([key, value]) => key in defaults && typeof value === "string",
    );
    return { ...defaults, ...Object.fromEntries(entries) };
  } catch {
    return { ...defaults };
  }
};

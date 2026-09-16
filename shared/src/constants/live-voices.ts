// OpenAI は声を性別でラベル付けしていないため、女声として聞こえるものを選んである。
export const LIVE_VOICES = ["marin", "coral", "sage", "shimmer"] as const;

export const DEFAULT_LIVE_VOICE = LIVE_VOICES[0];

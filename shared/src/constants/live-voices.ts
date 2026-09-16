// gpt-live-1 が受け付ける声のうち女声のもの。marin 以外は公式に記載が無く、
// 弾かれる可能性があるため既定は先頭の marin に置く。
export const LIVE_VOICES = ["marin", "coral", "sage", "shimmer"] as const;

export const DEFAULT_LIVE_VOICE = LIVE_VOICES[0];

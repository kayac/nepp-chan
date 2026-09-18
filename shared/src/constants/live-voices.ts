// gpt-live-1 は cedar / verse / ballad / alloy / ash / echo も受け付けるが、男声なので入れない。
export const LIVE_VOICES = [
  "sage",
  "marin",
  "coral",
  "shimmer",
  "delta",
  "gleam",
  "quartz",
] as const;

export const DEFAULT_LIVE_VOICE = LIVE_VOICES[0];

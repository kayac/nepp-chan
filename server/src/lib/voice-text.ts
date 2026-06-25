import { stripEmoji } from "~/lib/strip-emoji";

// TTS が読み上げてしまう装飾記号（* # ` ~）を除去する。delta 単位で適用するため
// markdown の構文解析は使えず、記号文字を直接落とす。- や全角 〜 は「3-4日」等を
// 壊すため対象外。
const SPOKEN_MARKUP = /[*#`~]/g;

export const sanitizeForSpeech = (text: string) =>
  stripEmoji(text).replace(SPOKEN_MARKUP, "");

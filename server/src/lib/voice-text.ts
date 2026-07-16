import { stripEmoji } from "~/lib/strip-emoji";

// TTS が読み上げてしまう装飾記号（* # `）を除去する。- や〜（全角/半角）は
// 範囲表記（3-4日・11:00~16:00等）を壊すため対象外。~~ は取り消し線のみ除去。
const STRIKETHROUGH = /~~/g;
const SPOKEN_MARKUP = /[*#`]/g;

export const sanitizeForSpeech = (text: string) =>
  stripEmoji(text).replace(STRIKETHROUGH, "").replace(SPOKEN_MARKUP, "");

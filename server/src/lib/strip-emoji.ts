// 絵文字（および肌色修飾子・国旗の地域表示子・ZWJ・異体字セレクタ・keycap）を除去する。
// 音声 TTS は絵文字を読めない／不自然に読むため、読み上げ前にテキストから外す。
// 合成記号 ZWJ(U+200D)・異体字セレクタ(U+FE0F)・keycap(U+20E3) は絵文字本体を剥がした残骸として消す。
const COMBINING = String.fromCodePoint(0x200d, 0xfe0f, 0x20e3);
const EMOJI = new RegExp(
  `\\p{Extended_Pictographic}|\\p{Emoji_Modifier}|\\p{Regional_Indicator}|[${COMBINING}]`,
  "gu",
);

export const stripEmoji = (text: string) => text.replace(EMOJI, "");

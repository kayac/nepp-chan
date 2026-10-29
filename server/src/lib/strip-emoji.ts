const COMBINING = String.fromCodePoint(0x200d, 0xfe0f, 0x20e3);
const EMOJI = new RegExp(
  `\\p{Extended_Pictographic}|\\p{Emoji_Modifier}|\\p{Regional_Indicator}|[${COMBINING}]`,
  "gu",
);

export const stripEmoji = (text: string) => text.replace(EMOJI, "");

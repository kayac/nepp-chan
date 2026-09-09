const EMOJI = /\p{Extended_Pictographic}/gu;
const BRIGHT_EMOJI = /[🎉✨😊😆🌸💕🥳🎊]/u;
const REPORT_TONE = [
  "確認できた情報",
  "確認できなかった",
  "確認できていない",
  "断定",
  "資料では",
  "公式情報",
  "今回の検索",
  "確認できた範囲",
];
const SERVICE_CLOSING = [
  "手伝えること",
  "ほかに何か",
  "他に何か",
  "何でも聞いて",
  "なんでも聞いて",
  "お気軽に",
];

export type Ending =
  | "period"
  | "exclamation"
  | "question"
  | "wave"
  | "emoji"
  | "other";

const plainText = (text: string) => text.replace(/\*\*/g, "");

const isEmoji = (ch: string) => new RegExp(EMOJI.source, "u").test(ch);

export const sentences = (text: string) =>
  plainText(text)
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[。！？!?])|(?<=\.)\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

const EMOJI_MODIFIERS = /[\uFE0F\u200D]+$/u;

export const endingOf = (sentence: string): Ending => {
  const last = [...sentence.replace(EMOJI_MODIFIERS, "")].at(-1) ?? "";
  if (isEmoji(last)) return "emoji";
  if (last === "。") return "period";
  if (last === "！" || last === "!") return "exclamation";
  if (last === "？" || last === "?") return "question";
  if (last === "〜" || last === "ー") return "wave";
  return "other";
};

export const countChars = (text: string) =>
  plainText(text).replace(/\s/g, "").length;

export const countEmoji = (text: string) =>
  (plainText(text).match(EMOJI) ?? []).length;

export const emojiPer100 = (text: string) => {
  const chars = countChars(text);
  return chars === 0 ? 0 : (countEmoji(text) / chars) * 100;
};

export const endingCounts = (text: string) => {
  const counts: Record<Ending, number> = {
    period: 0,
    exclamation: 0,
    question: 0,
    wave: 0,
    emoji: 0,
    other: 0,
  };
  for (const s of sentences(text)) counts[endingOf(s)]++;
  return counts;
};

const endingShare = (text: string, ending: Ending) => {
  const total = sentences(text).length;
  return total === 0 ? 0 : endingCounts(text)[ending] / total;
};

export const exclamationShare = (text: string) =>
  endingShare(text, "exclamation");

export const longestPeriodRun = (text: string) => {
  let run = 0;
  let longest = 0;
  for (const s of sentences(text)) {
    run = endingOf(s) === "period" ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
};

export const reportTonePhrases = (text: string) =>
  REPORT_TONE.filter((phrase) => text.includes(phrase));

export const serviceClosingPhrases = (text: string) => {
  const tail = sentences(text).slice(-2).join("");
  return SERVICE_CLOSING.filter((phrase) => tail.includes(phrase));
};

export const hasHeadings = (text: string) => /^#{1,3} /m.test(text);

const NUMBERED_ITEM = /^\s*\d+[.．、]\s*\S/;
const BULLET_ITEM = /^\s*[-・*]\s+\S/;
const isListItem = (line: string) =>
  NUMBERED_ITEM.test(line) || BULLET_ITEM.test(line);

export const hasNumberedList = (text: string) =>
  text.split("\n").some((l) => NUMBERED_ITEM.test(l));

export const hasBullets = (text: string) =>
  text.split("\n").some((l) => BULLET_ITEM.test(l));

export const hasMarkdown = (text: string) =>
  /\*\*|^#{1,3} |\[[^\]]+\]\(https?:/m.test(text);

export const hasBrightEmoji = (text: string) => BRIGHT_EMOJI.test(text);

export const timeTokenCount = (text: string) =>
  (text.match(/\d{1,2}:\d{2}/g) ?? []).length;

export const framingSentenceCount = (text: string) => {
  const lines = text.split("\n").map((l) => l.trim());
  const firstItem = lines.findIndex(isListItem);
  if (firstItem === -1) return 0;
  const lastItem =
    lines.length - 1 - [...lines].reverse().findIndex(isListItem);
  const before = lines.slice(0, firstItem).filter((l) => l.length > 1).length;
  const after = lines.slice(lastItem + 1).filter((l) => l.length > 1).length;
  return Math.min(before, 1) + Math.min(after, 1);
};

const POLITE_ENDING = /(です|ます|ました|ません|でした|ください)[。！？!?]?$/;
const CASUAL_ENDING =
  /(だよ|だね|かな|よね|なぁ|なあ|だな|だろうな|しよう|てね|ね|よ)[〜ー]*[。！？!?]?$/;

const TRAILING_EMOJI = /(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\s)+$/u;
const stripTrailingEmoji = (s: string) => s.replace(TRAILING_EMOJI, "");

export const politeEndingCount = (text: string) =>
  sentences(text).filter((s) => POLITE_ENDING.test(stripTrailingEmoji(s)))
    .length;

export const casualEndingCount = (text: string) =>
  sentences(text).filter((s) => CASUAL_ENDING.test(stripTrailingEmoji(s)))
    .length;

export const styleMetrics = (text: string) => ({
  emojiPer100: emojiPer100(text),
  periodShare: endingShare(text, "period"),
  structured: hasHeadings(text) || hasNumberedList(text),
});

const READING_ANNOTATION = /[一-龯々]+[（(][ぁ-んァ-ヶー]{2,}[）)]/g;
const INTERNAL_NAMES = [
  "knowledgeAgent",
  "webResearcherAgent",
  "emergencyReporterAgent",
  "personaAnalystAgent",
  "feedbackAgent",
  "emergencyAgent",
  "displayTableTool",
  "displayChartTool",
  "displayTimelineTool",
  "voiceAnswerTool",
  "knowledgeSearchTool",
  "broadcastGet",
  "pollGet",
  "Vectorize",
  "D1",
  "Mastra",
  "OpenAI",
  "GPT",
  "Gemini",
];
const PLACEHOLDER_NAME = /[○◯〇]{1,3}(さん|ちゃん|くん)/;
const RAW_URL = /(?<!\]\()https?:\/\/\S+/g;
const MARKDOWN_LINK = /\[[^\]]+\]\(https?:\/\/[^)]+\)/g;

export const readingAnnotations = (text: string) =>
  text.match(READING_ANNOTATION) ?? [];

export const internalNames = (text: string) =>
  INTERNAL_NAMES.filter((name) => text.includes(name));

export const hasPlaceholderName = (text: string) => PLACEHOLDER_NAME.test(text);

export const rawUrlCount = (text: string) => (text.match(RAW_URL) ?? []).length;

export const markdownLinkCount = (text: string) =>
  (text.match(MARKDOWN_LINK) ?? []).length;

export const listItemCount = (text: string) =>
  text.split("\n").filter(isListItem).length;

export const latinRatio = (text: string) => {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  const latin = letters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
  return latin / letters.length;
};

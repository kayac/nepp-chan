const GREETING_PREFIX = "新しい会話が始まりました。";
const GREETING_SUFFIX =
  "時間帯や季節に合った挨拶をして、最後に話したいことや手伝えることはないか尋ねてください。";

/** 新規スレッド開始時に挨拶を促すプロンプト */
export const GREETING_PROMPT = `${GREETING_PREFIX}${GREETING_SUFFIX}`;

/** location があれば、その場所への歓迎挨拶を促すプロンプトを返す */
export const buildGreetingPrompt = (location: string | null) =>
  location
    ? `${GREETING_PREFIX}ユーザーは今「${location}」にいます。${location}を訪れたことを歓迎しつつ、${GREETING_SUFFIX}`
    : GREETING_PROMPT;

/**
 * 送信テキストが生成済みの挨拶プロンプト（汎用 / location 版）かどうか。
 * intent 判定と UI 非表示に使う。前後の定型句で囲まれているかで判定する。
 */
export const isGreetingPrompt = (text: string) =>
  text.startsWith(GREETING_PREFIX) && text.endsWith(GREETING_SUFFIX);

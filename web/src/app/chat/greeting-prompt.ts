const GREETING_PREFIX = "新しい会話が始まりました。";
const GREETING_SUFFIX =
  "時間帯や季節に合った挨拶をねっぷちゃんらしく2〜3文でしてください。村の今の様子を一言添えて会話を始めてください。";

export const GREETING_PROMPT = `${GREETING_PREFIX}${GREETING_SUFFIX}`;

export const buildGreetingPrompt = (location: string | null) =>
  location
    ? `${GREETING_PREFIX}ユーザーは今「${location}」にいます。${location}を訪れたことを歓迎しつつ、${GREETING_SUFFIX}`
    : GREETING_PROMPT;

export const isGreetingPrompt = (text: string) =>
  text.startsWith(GREETING_PREFIX) && text.endsWith(GREETING_SUFFIX);

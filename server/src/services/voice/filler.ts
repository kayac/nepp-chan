const QUESTION_RE =
  /[?？]|教えて|ますか|ですか|でしょうか|どこ|どちら|だれ|誰|いつ|どう|どの|どれ|いくら|なに|何/u;

export const THINKING_FILLERS = ["えーっとね", "うーんとね"] as const;
export const BACKCHANNEL_FILLERS = [
  "うんうん",
  "そうなんだ",
  "なるほど",
] as const;

export const pickFiller = (voicePrompt: string, index: number) => {
  const pool = QUESTION_RE.test(voicePrompt)
    ? THINKING_FILLERS
    : BACKCHANNEL_FILLERS;
  return pool[index % pool.length];
};

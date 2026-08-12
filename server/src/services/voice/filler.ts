const QUESTION_RE =
  /[?？]|教えて|ますか|ですか|でしょうか|どこ|どちら|だれ|誰|いつ|どう|どの|どれ|いくら|なに|何/u;

export const isQuestionLike = (text: string) => QUESTION_RE.test(text);

export const THINKING_FILLERS = ["えーっとね", "うーんとね"] as const;
// 断片的な発話に対しても不自然にならないよう、特定の理解を装う表現は避ける。
export const BACKCHANNEL_FILLERS = ["うんうん"] as const;

export const pickFiller = (
  voicePrompt: string,
  index: number,
  pools: {
    thinking: readonly string[];
    backchannel: readonly string[];
  } = { thinking: THINKING_FILLERS, backchannel: BACKCHANNEL_FILLERS },
) => {
  const pool = isQuestionLike(voicePrompt) ? pools.thinking : pools.backchannel;
  return pool[index % pool.length];
};

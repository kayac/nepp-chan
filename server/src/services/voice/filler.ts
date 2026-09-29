import type { VoiceRoute } from "./turn-route";

const QUESTION_RE =
  /[?？]|教えて|ますか|ですか|でしょうか|どこ|どちら|だれ|誰|いつ|どう|どの|どれ|いくら|なに|何/u;

export const isQuestionLike = (text: string) => QUESTION_RE.test(text);

export const THINKING_FILLERS = ["えーっとね", "うーんとね"] as const;
export const BACKCHANNEL_FILLERS: readonly string[] = [];

export const pickFiller = (
  route: VoiceRoute,
  index: number,
  pools: {
    thinking: readonly string[];
    backchannel: readonly string[];
  } = { thinking: THINKING_FILLERS, backchannel: BACKCHANNEL_FILLERS },
) => {
  const pool = route === "none" ? pools.backchannel : pools.thinking;
  return pool.length > 0 ? pool[index % pool.length] : undefined;
};

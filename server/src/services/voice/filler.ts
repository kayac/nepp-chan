import type { Backchannel, TurnClass } from "~/lib/classify-intent";

export const THINKING_FILLERS = ["えーっとね", "うーんとね"] as const;

const BACKCHANNEL_PHRASES: Record<Backchannel, string | undefined> = {
  greeting: undefined,
  agree: "うん！",
  happy: "いいね〜！",
  sad: "そっかぁ…",
  surprise: "えーーーー！",
  ask: "え〜〜",
  listen: "うん、うん！",
};

export const pickFiller = (
  turn: Pick<TurnClass, "route" | "backchannel">,
  index: number,
  thinking: readonly string[] = THINKING_FILLERS,
) => {
  if (turn.route === "none") {
    return turn.backchannel && BACKCHANNEL_PHRASES[turn.backchannel];
  }
  return thinking.length > 0 ? thinking[index % thinking.length] : undefined;
};

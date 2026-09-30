import type { TurnRoute } from "~/lib/classify-intent";

export const THINKING_FILLERS = ["えーっとね", "うーんとね"] as const;
export const BACKCHANNEL_FILLERS: readonly string[] = [];

export const pickFiller = (
  route: TurnRoute,
  index: number,
  pools: {
    thinking: readonly string[];
    backchannel: readonly string[];
  } = { thinking: THINKING_FILLERS, backchannel: BACKCHANNEL_FILLERS },
) => {
  const pool = route === "none" ? pools.backchannel : pools.thinking;
  return pool.length > 0 ? pool[index % pool.length] : undefined;
};

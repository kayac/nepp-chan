import type { RequestContext } from "@mastra/core/request-context";
import { logger } from "~/lib/logger";
import { createDecider, type YesNoQuestion } from "~/services/decision/decider";

const STOP_THRESHOLD = 0.5;

const stopQuestion: YesNoQuestion = {
  type: "yesno",
  instructions:
    "通話中、アシスタントが調べ物や返事の準備をしている間に、ユーザーが言った言葉。今準備している返事や調べ物をやめてほしい、取り消したいと言っているかを判定する。",
  criteria: {
    true: "やめて、もういい、キャンセル、やっぱりいい、別の話にして、など今の返事を取り消す発言。",
    false:
      "まだ？、調べてるの？、相槌、雑談、独り言、追加の質問など、待っている間の発言。",
  },
};

export const isStopRequest = async (
  text: string,
  requestContext: RequestContext,
) => {
  const decider = createDecider(requestContext, {
    source: "intent-classify",
    agent: "voice-stop",
  });
  if (!decider) return true;
  try {
    const { stop } = await decider.decide([{ from: "user", text }], {
      stop: stopQuestion,
    });
    return stop.p >= STOP_THRESHOLD;
  } catch (error) {
    logger.warn("[Voice] stop request check failed, stopping the turn", {
      error: String(error),
    });
    return true;
  }
};

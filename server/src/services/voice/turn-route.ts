import type { RequestContext } from "@mastra/core/request-context";
import { type JevQuestion, jevApiKey } from "~/lib/jev";
import { logger } from "~/lib/logger";
import {
  OUTSIDE_CRITERION,
  ROUTE_CONTEXT,
  VILLAGE_CRITERION,
  VILLAGE_THRESHOLD,
} from "~/lib/route-criteria";
import { askJevWithUsage } from "~/services/analytics/llm-usage";
import { isQuestionLike } from "./filler";

export type VoiceRoute = "none" | "village" | "outside";

const routeQuestion: JevQuestion = {
  type: "choice",
  instructions: `${ROUTE_CONTEXT}ユーザーの最新のメッセージに答えるために、アシスタントが何を調べる必要があるかを判定する。`,
  criteria: {
    none: "調べるものがない。挨拶、雑談、気持ち、ユーザーがすでに言ったことの言い換えや整理、アシスタントが実行できない依頼。",
    village: VILLAGE_CRITERION,
    outside: OUTSIDE_CRITERION,
  },
};

const fallbackRoute = (text: string): VoiceRoute =>
  isQuestionLike(text) ? "village" : "none";

export const classifyVoiceTurn = async ({
  text,
  requestContext,
}: {
  text: string;
  requestContext: RequestContext;
}) => {
  const apiKey = jevApiKey(requestContext);
  if (!apiKey) return fallbackRoute(text);
  try {
    const response = await askJevWithUsage({
      apiKey,
      state: [{ from: "user", text }],
      questions: { route: routeQuestion },
      requestContext,
      source: "research-route",
      agent: "voice-router",
    });
    const answer = response.answers.route;
    if (answer?.type !== "choice") return fallbackRoute(text);
    const { none = 0, village = 0, outside = 0 } = answer.probabilities;
    if (village >= VILLAGE_THRESHOLD) return "village";
    return outside > none ? "outside" : "none";
  } catch (error) {
    logger.warn("[Voice] jev route failed, falling back to question check", {
      error: String(error),
    });
    return fallbackRoute(text);
  }
};

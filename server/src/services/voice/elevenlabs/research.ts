import { logger } from "~/lib/logger";
import { createRequestContext } from "~/mastra/request-context";
import { newTurnId } from "~/services/analytics/llm-usage";
import { research } from "~/services/research";

const FAILED_ANSWER = "ごめんね、うまく調べられなかったみたい。";

export const runResearch = async ({
  env,
  question,
  aspects,
}: {
  env: CloudflareBindings;
  question: string;
  aspects?: { topic: string; queries: string[] }[];
}) => {
  const requestContext = createRequestContext({
    db: env.DB,
    env,
    usagePlatform: "voice",
    usageTurnId: newTurnId(),
  });
  const start = Date.now();
  const answer = await research(
    {
      question,
      aspects: aspects?.length
        ? aspects
        : [{ topic: question, queries: [question] }],
    },
    { requestContext },
  )
    .then((materials) => materials.trim() || FAILED_ANSWER)
    .catch((error) => {
      logger.error("[Voice][EL] research failed", error);
      return FAILED_ANSWER;
    });
  logger.info("[Voice][EL] research done", {
    ms: Date.now() - start,
    questionChars: question.length,
    aspects: aspects?.length ?? 0,
    answerChars: answer.length,
  });
  return answer;
};

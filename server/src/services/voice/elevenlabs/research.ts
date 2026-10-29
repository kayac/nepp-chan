import { noopObserve } from "@mastra/core/tools";
import { logger } from "~/lib/logger";
import { createRequestContext } from "~/mastra/request-context";
import { voiceAnswerTool } from "~/mastra/tools/voice-answer-tool";
import { newTurnId } from "~/services/analytics/llm-usage";

const FAILED_ANSWER = "ごめんね、うまく調べられなかったみたい。";

export const runResearch = async ({
  env,
  question,
}: {
  env: CloudflareBindings;
  question: string;
}) => {
  const requestContext = createRequestContext({
    db: env.DB,
    env,
    usagePlatform: "voice",
    usageTurnId: newTurnId(),
  });
  const start = Date.now();
  const result = (await voiceAnswerTool.execute?.(
    { question },
    { requestContext, observe: noopObserve },
  )) as { answer?: string } | undefined;
  const answer = result?.answer ?? FAILED_ANSWER;
  logger.info("[Voice][EL] research done", {
    ms: Date.now() - start,
    questionChars: question.length,
    answerChars: answer.length,
  });
  return answer;
};

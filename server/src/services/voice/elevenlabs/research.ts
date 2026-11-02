import { logger } from "~/lib/logger";
import { createKnowledgeAgent } from "~/mastra/agents/knowledge-agent";
import { createWebResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import { createRequestContext } from "~/mastra/request-context";
import { newTurnId } from "~/services/analytics/llm-usage";

const FAILED_ANSWER = "ごめんね、うまく調べられなかったみたい。";

const knowledgeAgent = createKnowledgeAgent({ effort: "low" });
const webAgent = createWebResearcherAgent();

export const runResearch = async ({
  env,
  question,
  source,
}: {
  env: CloudflareBindings;
  question: string;
  source: "knowledge" | "web";
}) => {
  const requestContext = createRequestContext({
    db: env.DB,
    env,
    usagePlatform: "voice",
    usageTurnId: newTurnId(),
  });
  const agent = source === "web" ? webAgent : knowledgeAgent;
  const start = Date.now();
  const answer = await agent
    .generate(question, { requestContext })
    .then((res) => (res.text ?? "").trim() || FAILED_ANSWER)
    .catch((error) => {
      logger.error("[Voice][EL] research failed", error, { source });
      return FAILED_ANSWER;
    });
  logger.info("[Voice][EL] research done", {
    source,
    ms: Date.now() - start,
    questionChars: question.length,
    answerChars: answer.length,
  });
  return answer;
};

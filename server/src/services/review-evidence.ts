import { logger } from "~/lib/logger";
import { redactPii } from "~/lib/pii";
import type { RetrievalHit } from "~/services/knowledge/retrieval-trace";

export type DecisionEvidence = {
  question: string | null;
  answer: string | null;
  runs: Array<{ query: string; sources: string[] }>;
};

export const buildDecisionEvidence = async (params: {
  conversation: { question: string | null; answer: string } | null;
  runs: Array<{ query: string; hits: RetrievalHit[] }>;
}): Promise<DecisionEvidence> => {
  const question = params.conversation?.question ?? null;
  const answer = params.conversation?.answer ?? null;
  const sourcesOf = (hits: RetrievalHit[]) =>
    hits.map((hit) =>
      hit.section ? `${hit.source}#${hit.section}` : hit.source,
    );

  try {
    const [redactedQuestion, redactedAnswer, ...redactedQueries] =
      await redactPii([
        question ?? "",
        answer ?? "",
        ...params.runs.map((run) => run.query),
      ]);

    return {
      question: question === null ? null : redactedQuestion,
      answer: answer === null ? null : redactedAnswer,
      runs: params.runs.map((run, index) => ({
        query: redactedQueries[index],
        sources: sourcesOf(run.hits),
      })),
    };
  } catch (error) {
    logger.warn("[Review] failed to redact evidence", { error: String(error) });
    return {
      question: null,
      answer: null,
      runs: params.runs.map((run) => ({
        query: "",
        sources: sourcesOf(run.hits),
      })),
    };
  }
};

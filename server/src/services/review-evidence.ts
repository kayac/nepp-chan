import type { MastraDBMessage } from "@mastra/core/agent";
import { PIIDetector } from "@mastra/core/processors";
import { OPENAI_LITE, reasoningProviderOptions } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import type { RetrievalHit } from "~/services/knowledge/retrieval-trace";

export type DecisionEvidence = {
  question: string | null;
  answer: string | null;
  runs: Array<{ query: string; sources: string[] }>;
};

const PII_TYPES = ["name", "address", "phone", "email", "date-of-birth"];

const toMessage = (text: string, index: number): MastraDBMessage => ({
  id: String(index),
  role: "user",
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: "text", text }] },
});

const textOf = (message: MastraDBMessage) =>
  message.content.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");

export const redactPii = async (texts: string[]) => {
  const filled = texts.filter((text) => text.trim().length > 0);
  if (filled.length === 0) return texts;

  const detector = new PIIDetector({
    model: OPENAI_LITE,
    providerOptions: reasoningProviderOptions("low"),
    detectionTypes: PII_TYPES,
    strategy: "redact",
    redactionMethod: "placeholder",
  });

  const redacted = new Map<string, string>();
  const processed = await detector.processInput({
    messages: filled.map(toMessage),
    abort: (reason) => {
      throw new Error(reason ?? "PII redaction aborted");
    },
  });
  for (const [index, message] of processed.entries()) {
    redacted.set(filled[index], textOf(message));
  }

  return texts.map((text) => redacted.get(text) ?? text);
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

import type { RequestContext } from "@mastra/core/request-context";
import { askJev, JEV_MODEL, type JevQuestion } from "~/lib/jev";
import {
  type LlmUsageSource,
  recordUsageFromContext,
  runInBackground,
} from "~/services/analytics/llm-usage";

type Criteria = Record<string, string>;

export type ChoiceQuestion<C extends Criteria = Criteria> = {
  type: "choice";
  instructions: string;
  criteria: C;
};

export type YesNoQuestion = {
  type: "yesno";
  instructions: string;
  criteria?: { true?: string; false?: string };
};

type Question = ChoiceQuestion | YesNoQuestion;

type Questions = Record<string, Question>;

type ChoiceAnswer<C extends Criteria> = {
  choice: keyof C & string;
  probabilities: Record<keyof C & string, number>;
};

type YesNoAnswer = { p: number };

type AnswerOf<Q extends Question> =
  Q extends ChoiceQuestion<infer C> ? ChoiceAnswer<C> : YesNoAnswer;

export type Answers<Qs extends Questions> = {
  [K in keyof Qs]: AnswerOf<Qs[K]>;
};

const toJevQuestion = (question: Question): JevQuestion =>
  question.type === "yesno" ? { ...question, type: "noul" } : question;

const toAnswer = (
  key: string,
  question: Question,
  answer: Awaited<ReturnType<typeof askJev>>["answers"][string] | undefined,
) => {
  if (question.type === "yesno") {
    if (answer?.type !== "noul")
      throw new Error(`jev answer ${key} is not noul`);
    return { p: answer.noul };
  }
  const options = Object.keys(question.criteria);
  if (
    answer?.type !== "choice" ||
    !options.includes(answer.choice) ||
    options.some((option) => answer.probabilities[option] === undefined)
  ) {
    throw new Error(`jev answer ${key} does not match the choices`);
  }
  return { choice: answer.choice, probabilities: answer.probabilities };
};

export const createDecider = (
  requestContext: RequestContext | undefined,
  usage: { source: LlmUsageSource; agent: string },
) => {
  const apiKey = (requestContext?.get("env") as CloudflareBindings | undefined)
    ?.TYPESAFE_API_KEY;
  if (!apiKey) return undefined;
  return {
    decide: async <Qs extends Questions>(state: unknown, questions: Qs) => {
      const startedAt = Date.now();
      const response = await askJev({
        apiKey,
        state,
        questions: Object.fromEntries(
          Object.entries(questions).map(([key, q]) => [key, toJevQuestion(q)]),
        ),
      });
      runInBackground(
        recordUsageFromContext(requestContext, {
          model: response.model ?? JEV_MODEL,
          usage: {
            inputTokens: response.usage?.input_tokens,
            outputTokens: response.usage?.output_tokens,
          },
          ...usage,
          durationMs: Date.now() - startedAt,
        }),
      );
      return Object.fromEntries(
        Object.entries(questions).map(([key, q]) => [
          key,
          toAnswer(key, q, response.answers[key]),
        ]),
      ) as Answers<Qs>;
    },
  };
};

export type Decider = NonNullable<ReturnType<typeof createDecider>>;

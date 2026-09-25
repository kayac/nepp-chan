import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";

const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_TIMEOUT_MS = 2000;
export const JEV_MODEL = "jev-latest";

export type JevQuestion =
  | {
      type: "noul";
      instructions: string;
      criteria?: { true?: string; false?: string };
    }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

const probability = z.number().min(0).max(1);

const answerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("noul"),
    noul: probability,
    confidence: probability.optional(),
  }),
  z.object({
    type: z.literal("choice"),
    choice: z.string(),
    probabilities: z.record(z.string(), probability),
    confidence: probability.optional(),
  }),
  z.object({
    type: z.literal("score"),
    score: z.number(),
    confidence: probability.optional(),
  }),
]);

const responseSchema = z.object({
  model: z.string().optional(),
  answers: z.record(z.string(), answerSchema),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
    })
    .optional(),
});

export class JevHttpError extends Error {
  constructor(readonly status: number) {
    super(`jev responded ${status}`);
  }
}

export const jevApiKey = (requestContext?: RequestContext) =>
  (requestContext?.get("env") as CloudflareBindings | undefined)
    ?.TYPESAFE_API_KEY;

export const askJev = async (params: {
  apiKey: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
}) => {
  const res = await fetch(JEV_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: JEV_MODEL,
      state: params.state,
      questions: params.questions,
    }),
    signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
  });
  if (!res.ok) throw new JevHttpError(res.status);
  return responseSchema.parse(await res.json());
};

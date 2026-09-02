import type { RequestContext } from "@mastra/core/request-context";
import { logger } from "~/lib/logger";
import { waitUntilInBackground } from "~/lib/wait-until";
import { getRequestDb } from "~/mastra/request-context";
import { reviewRepository } from "~/repository/review-repository";

export type RetrievalHit = {
  source: string;
  title?: string;
  section?: string;
  score: number;
  rerankScore?: number;
  contentHash?: string;
};

type RecordRetrievalRunParams = {
  query: string;
  hits: RetrievalHit[];
  durationMs?: number;
};

export const recordRetrievalRun = async (
  requestContext: RequestContext | undefined,
  params: RecordRetrievalRunParams,
) => {
  const d1 = getRequestDb(requestContext);
  if (!d1) return;
  try {
    await reviewRepository.insertRun(d1, {
      id: crypto.randomUUID(),
      answerRunId: requestContext?.get("answerRunId") as string | undefined,
      threadId: requestContext?.get("usageThreadId") as string | undefined,
      turnIndex: requestContext?.get("usageTurnIndex") as number | undefined,
      query: params.query,
      hits: JSON.stringify(params.hits),
      durationMs: params.durationMs,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn("[RetrievalTrace] failed to record run", {
      error: String(error),
    });
  }
};

export const recordRetrievalRunInBackground = (
  requestContext: RequestContext | undefined,
  params: RecordRetrievalRunParams,
) => {
  const recording = recordRetrievalRun(requestContext, params);
  const pending = requestContext?.get("retrievalTracePending") as
    | Promise<unknown>[]
    | undefined;
  pending?.push(recording);
  waitUntilInBackground(recording);
};

export const linkRetrievalRunsToMessage = async (
  requestContext: RequestContext | undefined,
  messageId: string,
) => {
  const d1 = getRequestDb(requestContext);
  const answerRunId = requestContext?.get("answerRunId") as string | undefined;
  if (!d1 || !answerRunId) return;
  const pending = requestContext?.get("retrievalTracePending") as
    | Promise<unknown>[]
    | undefined;
  if (pending?.length) {
    await Promise.allSettled(pending);
  }
  try {
    await reviewRepository.linkRunsToMessage(d1, answerRunId, messageId);
  } catch (error) {
    logger.warn("[RetrievalTrace] failed to link message", {
      error: String(error),
    });
  }
};

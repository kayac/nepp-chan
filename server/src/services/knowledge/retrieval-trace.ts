import type { RequestContext } from "@mastra/core/request-context";
import { and, eq, isNull } from "drizzle-orm";
import { createDb, retrievalRuns } from "~/db";
import { logger } from "~/lib/logger";
import { waitUntilInBackground } from "~/lib/wait-until";

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
  const d1 = requestContext?.get("db") as D1Database | undefined;
  if (!d1) return;
  try {
    const db = createDb(d1);
    await db.insert(retrievalRuns).values({
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
  const d1 = requestContext?.get("db") as D1Database | undefined;
  const answerRunId = requestContext?.get("answerRunId") as string | undefined;
  if (!d1 || !answerRunId) return;
  const pending = requestContext?.get("retrievalTracePending") as
    | Promise<unknown>[]
    | undefined;
  if (pending?.length) {
    await Promise.allSettled(pending);
  }
  try {
    const db = createDb(d1);
    await db
      .update(retrievalRuns)
      .set({ messageId })
      .where(
        and(
          eq(retrievalRuns.answerRunId, answerRunId),
          isNull(retrievalRuns.messageId),
        ),
      );
  } catch (error) {
    logger.warn("[RetrievalTrace] failed to link message", {
      error: String(error),
    });
  }
};

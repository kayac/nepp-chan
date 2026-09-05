import { GEMINI_EMBEDDING } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { recordLlmUsage } from "~/services/analytics/llm-usage";
import { chunkDocument } from "./chunk";
import { generateEmbeddings } from "./embedding";
import {
  deleteVectors,
  readChunkCount,
  sourceIdPrefix,
  upsertVectors,
  vectorId,
} from "./vector-store";

export type R2EventMessage = {
  account: string;
  bucket: string;
  eventTime: string;
  action:
    | "PutObject"
    | "CompleteMultipartUpload"
    | "CopyObject"
    | "DeleteObject"
    | "LifecycleDeletion";
  object: { key: string; size: number; eTag: string };
};

type SyncDeps = {
  vectorize: VectorizeIndex;
  apiKey: string;
  d1?: D1Database;
};

const SEND_BATCH_SIZE = 100;

export const syncFile = async (
  key: string,
  content: string,
  { vectorize, apiKey, d1 }: SyncDeps,
): Promise<{ chunks: number; error?: string }> => {
  try {
    const { texts, metadata } = await chunkDocument(key, content);
    const prefix = await sourceIdPrefix(key);

    const previousCount = await readChunkCount(vectorize, prefix);
    if (previousCount > texts.length) {
      await deleteVectors(
        vectorize,
        Array.from({ length: previousCount - texts.length }, (_, i) =>
          vectorId(prefix, texts.length + i),
        ),
      );
    }

    if (texts.length === 0) {
      return { chunks: 0 };
    }

    const { embeddings, tokens } = await generateEmbeddings(texts, apiKey);
    if (d1) {
      await recordLlmUsage(d1, {
        model: GEMINI_EMBEDDING,
        usage: { inputTokens: tokens },
        source: "embedding",
        agent: "embedding",
      });
    }

    await upsertVectors(
      vectorize,
      texts.map((_, i) => ({
        id: vectorId(prefix, i),
        values: embeddings[i],
        metadata: { ...metadata[i], chunkCount: texts.length },
      })),
    );

    return { chunks: texts.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { chunks: 0, error: message };
  }
};

export const syncAll = async (
  bucket: R2Bucket,
  queue: Queue<R2EventMessage>,
) => {
  const listed = await bucket.list();
  const targets = listed.objects.filter(
    (obj) => obj.key.endsWith(".md") && !obj.key.startsWith("originals/"),
  );

  const messages = targets.map((obj) => ({
    body: {
      account: "",
      bucket: "",
      eventTime: new Date().toISOString(),
      action: "PutObject" as const,
      object: { key: obj.key, size: obj.size, eTag: obj.etag },
    },
  }));
  for (let i = 0; i < messages.length; i += SEND_BATCH_SIZE) {
    await queue.sendBatch(messages.slice(i, i + SEND_BATCH_SIZE));
  }

  logger.info(`[Sync] Queued ${messages.length} markdown files`);
  return { queued: messages.length };
};

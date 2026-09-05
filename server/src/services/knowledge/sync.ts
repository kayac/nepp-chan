import { GEMINI_EMBEDDING } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { recordLlmUsage } from "~/services/analytics/llm-usage";
import { chunkDocument } from "./chunk";
import { generateEmbeddings } from "./embedding";
import {
  buildOriginalsMap,
  isEditedAfterOriginal,
  markdownBaseName,
} from "./utils";
import {
  deleteVectors,
  readChunkCount,
  sourceIdPrefix,
  upsertVectors,
  vectorId,
} from "./vector-store";

type SyncResult = {
  file: string;
  chunks: number;
  error?: string;
  edited?: boolean;
};

type SyncAllResult = {
  results: SyncResult[];
  totalFiles: number;
  totalChunks: number;
  editedCount: number;
};

export type SyncDeps = {
  bucket: R2Bucket;
  vectorize: VectorizeIndex;
  apiKey: string;
  d1?: D1Database;
};

export const syncFile = async (
  key: string,
  content: string,
  { vectorize, apiKey, d1 }: Omit<SyncDeps, "bucket">,
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

export const storeMarkdownAndSync = async (
  key: string,
  markdown: string,
  deps: SyncDeps,
) => {
  await deps.bucket.put(key, markdown, {
    httpMetadata: { contentType: "text/markdown" },
  });
  return syncFile(key, markdown, deps);
};

export const syncAll = async ({
  bucket,
  vectorize,
  apiKey,
  d1,
}: SyncDeps): Promise<SyncAllResult> => {
  const listed = await bucket.list();
  const allObjects = listed.objects;

  const mdFiles = allObjects.filter(
    (obj) => obj.key.endsWith(".md") && !obj.key.startsWith("originals/"),
  );
  const originalsMap = buildOriginalsMap(allObjects);

  logger.info(`[Sync] Found ${mdFiles.length} markdown files`);

  const results: SyncResult[] = [];

  for (const obj of mdFiles) {
    const file = await bucket.get(obj.key);
    if (!file) {
      results.push({ file: obj.key, chunks: 0, error: "File not found" });
      continue;
    }

    const edited = isEditedAfterOriginal(
      obj.uploaded,
      originalsMap.get(markdownBaseName(obj.key)),
    );
    const content = await file.text();
    logger.info(
      `[Sync] Processing ${obj.key} (${content.length} bytes)${edited ? " [EDITED]" : ""}`,
    );

    const result = await syncFile(obj.key, content, { vectorize, apiKey, d1 });

    results.push({
      file: obj.key,
      chunks: result.chunks,
      error: result.error,
      edited,
    });
  }

  return {
    results,
    totalFiles: mdFiles.length,
    totalChunks: results.reduce((sum, r) => sum + r.chunks, 0),
    editedCount: results.filter((r) => r.edited).length,
  };
};

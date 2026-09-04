import { logger } from "~/lib/logger";
import { processKnowledgeFile } from "./embedding";
import {
  buildOriginalsMap,
  isEditedAfterOriginal,
  markdownBaseName,
} from "./utils";
import { deleteKnowledgeBySource } from "./vector-store";

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
  deps: Omit<SyncDeps, "bucket">,
): Promise<{ chunks: number; error?: string }> => {
  await deleteKnowledgeBySource(deps.vectorize, key);
  return processKnowledgeFile(
    key,
    content,
    deps.vectorize,
    deps.apiKey,
    deps.d1,
  );
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

import { logger } from "~/lib/logger";
import { indexKnowledgeSource } from "./indexing";
import { buildOriginalsMap, EDIT_THRESHOLD_MS } from "./utils";

type SyncResult = {
  file: string;
  chunks: number;
  error?: string;
  edited?: boolean;
  skipped?: boolean;
};

type SyncAllResult = {
  results: SyncResult[];
  totalFiles: number;
  totalChunks: number;
  editedCount: number;
  skippedCount: number;
};

type SyncDeps = {
  bucket: R2Bucket;
  vectorize: VectorizeIndex;
  apiKey: string;
  d1: D1Database;
};

const isFileEdited = (mdFile: R2Object, originalsMap: Map<string, Date>) => {
  const baseName = mdFile.key.replace(/\.md$/, "");
  const originalUploaded = originalsMap.get(baseName);
  if (!originalUploaded) return false;
  return (
    mdFile.uploaded.getTime() - originalUploaded.getTime() > EDIT_THRESHOLD_MS
  );
};

export const listMarkdownObjects = async (bucket: R2Bucket) => {
  const listed = await bucket.list();
  return {
    allObjects: listed.objects,
    mdFiles: listed.objects.filter(
      (obj) => obj.key.endsWith(".md") && !obj.key.startsWith("originals/"),
    ),
  };
};

/**
 * R2バケットの全Markdownファイルを読み込み、Vectorizeに同期
 */
export const syncAll = async ({
  bucket,
  vectorize,
  apiKey,
  d1,
}: SyncDeps): Promise<SyncAllResult> => {
  const { allObjects, mdFiles } = await listMarkdownObjects(bucket);
  const originalsMap = buildOriginalsMap(allObjects);

  logger.info(`[Sync] Found ${mdFiles.length} markdown files`);

  const results: SyncResult[] = [];

  for (const obj of mdFiles) {
    const file = await bucket.get(obj.key);
    if (!file) {
      results.push({ file: obj.key, chunks: 0, error: "File not found" });
      continue;
    }

    const edited = isFileEdited(obj, originalsMap);
    const content = await file.text();
    logger.info(
      `[Sync] Processing ${obj.key} (${content.length} bytes)${edited ? " [EDITED]" : ""}`,
    );

    const result = await indexKnowledgeSource(
      obj.key,
      content,
      { d1, vectorize, apiKey },
      { r2Etag: obj.etag },
    );

    results.push({
      file: obj.key,
      chunks: result.chunks,
      error: result.error,
      edited,
      skipped: result.indexed ? undefined : true,
    });
  }

  return {
    results,
    totalFiles: mdFiles.length,
    totalChunks: results.reduce((sum, r) => sum + r.chunks, 0),
    editedCount: results.filter((r) => r.edited).length,
    skippedCount: results.filter((r) => r.skipped).length,
  };
};

/**
 * 単一ファイルを同期（保存 + Vectorize登録）
 */
export const syncFile = async (
  key: string,
  content: string,
  deps: Omit<SyncDeps, "bucket"> & { approveAs?: string },
) => {
  return indexKnowledgeSource(
    key,
    content,
    { d1: deps.d1, vectorize: deps.vectorize, apiKey: deps.apiKey },
    { approveAs: deps.approveAs },
  );
};

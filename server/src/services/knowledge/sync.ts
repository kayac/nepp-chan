import { logger } from "~/lib/logger";
import { deleteKnowledgeBySource, processKnowledgeFile } from "./embedding";
import { buildOriginalsMap, EDIT_THRESHOLD_MS } from "./utils";

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

type SyncDeps = {
  bucket: R2Bucket;
  vectorize: VectorizeIndex;
  apiKey: string;
};

const isFileEdited = (mdFile: R2Object, originalsMap: Map<string, Date>) => {
  const baseName = mdFile.key.replace(/\.md$/, "");
  const originalUploaded = originalsMap.get(baseName);
  if (!originalUploaded) return false;
  return (
    mdFile.uploaded.getTime() - originalUploaded.getTime() > EDIT_THRESHOLD_MS
  );
};

/**
 * R2バケットの全Markdownファイルを読み込み、Vectorizeに同期
 */
export const syncAll = async ({
  bucket,
  vectorize,
  apiKey,
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

    const edited = isFileEdited(obj, originalsMap);
    const content = await file.text();
    logger.info(
      `[Sync] Processing ${obj.key} (${content.length} bytes)${edited ? " [EDITED]" : ""}`,
    );

    await deleteKnowledgeBySource(vectorize, obj.key);
    const result = await processKnowledgeFile(
      obj.key,
      content,
      vectorize,
      apiKey,
    );

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

/**
 * 単一ファイルを同期（保存 + Vectorize登録）
 */
export const syncFile = async (
  key: string,
  content: string,
  deps: Omit<SyncDeps, "bucket">,
): Promise<{ chunks: number; error?: string }> => {
  await deleteKnowledgeBySource(deps.vectorize, key);
  return processKnowledgeFile(key, content, deps.vectorize, deps.apiKey);
};

import { logger } from "~/lib/logger";
import { deleteKnowledgeBySource } from "./embedding";

const EDIT_THRESHOLD_MS = 5000;

export type FileInfo = {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
  edited?: boolean;
};

export type UnifiedFileInfo = {
  baseName: string;
  original?: {
    key: string;
    size: number;
    lastModified: string;
    contentType: string;
  };
  markdown?: {
    key: string;
    size: number;
    lastModified: string;
  };
  hasMarkdown: boolean;
};

export type FileContent = {
  key: string;
  content: string;
  contentType: string;
  size: number;
  lastModified: string;
};

const extractBaseName = (key: string) =>
  key.replace("originals/", "").replace(/\.[^.]+$/, "");

const buildOriginalsMap = (objects: R2Object[]) => {
  const map = new Map<string, Date>();
  for (const obj of objects) {
    if (obj.key.startsWith("originals/")) {
      map.set(extractBaseName(obj.key), obj.uploaded);
    }
  }
  return map;
};

/**
 * ファイル一覧を取得（編集済み情報付き）
 */
export const listFiles = async (
  bucket: R2Bucket,
): Promise<{ files: FileInfo[]; truncated: boolean }> => {
  const listed = await bucket.list({ limit: 1000 });
  const allObjects = listed.objects;
  const originalsMap = buildOriginalsMap(allObjects);

  const files = allObjects
    .filter((obj) => !obj.key.startsWith("originals/"))
    .map((obj) => {
      const baseName = obj.key.replace(/\.md$/, "");
      const originalUploaded = originalsMap.get(baseName);
      const isEdited =
        originalUploaded !== undefined &&
        obj.uploaded.getTime() - originalUploaded.getTime() > EDIT_THRESHOLD_MS;

      return {
        key: obj.key,
        size: obj.size,
        lastModified: obj.uploaded.toISOString(),
        etag: obj.etag,
        edited: isEdited || undefined,
      };
    });

  return { files, truncated: listed.truncated };
};

/**
 * 統合ファイル一覧を取得（元ファイルとMarkdownを紐付け）
 */
export const listUnifiedFiles = async (
  bucket: R2Bucket,
): Promise<{ files: UnifiedFileInfo[]; truncated: boolean }> => {
  const listed = await bucket.list({ limit: 1000 });
  const allObjects = listed.objects;

  const originalsMap = new Map<
    string,
    { key: string; size: number; uploaded: Date; contentType: string }
  >();
  for (const obj of allObjects) {
    if (obj.key.startsWith("originals/")) {
      const baseName = extractBaseName(obj.key);
      const file = await bucket.head(obj.key);
      originalsMap.set(baseName, {
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        contentType:
          file?.httpMetadata?.contentType || "application/octet-stream",
      });
    }
  }

  const markdownMap = new Map<
    string,
    { key: string; size: number; uploaded: Date }
  >();
  for (const obj of allObjects) {
    if (obj.key.endsWith(".md") && !obj.key.startsWith("originals/")) {
      const baseName = obj.key.replace(/\.md$/, "");
      markdownMap.set(baseName, {
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
      });
    }
  }

  const allBaseNames = new Set([...originalsMap.keys(), ...markdownMap.keys()]);
  const files: UnifiedFileInfo[] = [];

  for (const baseName of allBaseNames) {
    const original = originalsMap.get(baseName);
    const markdown = markdownMap.get(baseName);

    files.push({
      baseName,
      original: original
        ? {
            key: original.key,
            size: original.size,
            lastModified: original.uploaded.toISOString(),
            contentType: original.contentType,
          }
        : undefined,
      markdown: markdown
        ? {
            key: markdown.key,
            size: markdown.size,
            lastModified: markdown.uploaded.toISOString(),
          }
        : undefined,
      hasMarkdown: !!markdown,
    });
  }

  files.sort((a, b) => {
    const aDate = a.markdown?.lastModified || a.original?.lastModified || "";
    const bDate = b.markdown?.lastModified || b.original?.lastModified || "";
    return bDate.localeCompare(aDate);
  });

  return { files, truncated: listed.truncated };
};

/**
 * ファイル内容を取得
 */
export const getFile = async (
  bucket: R2Bucket,
  key: string,
): Promise<FileContent | null> => {
  const object = await bucket.get(key);
  if (!object) return null;

  const content = await object.text();
  return {
    key,
    content,
    contentType: object.httpMetadata?.contentType || "text/markdown",
    size: object.size,
    lastModified: object.uploaded.toISOString(),
  };
};

/**
 * 元ファイル（バイナリ）を取得
 */
export const getOriginalFile = async (
  bucket: R2Bucket,
  key: string,
): Promise<{ body: ArrayBuffer; contentType: string; size: number } | null> => {
  const fullKey = `originals/${key}`;
  const object = await bucket.get(fullKey);
  if (!object) return null;

  return {
    body: await object.arrayBuffer(),
    contentType: object.httpMetadata?.contentType || "application/octet-stream",
    size: object.size,
  };
};

/**
 * ファイルを完全削除（Markdown、元ファイル、Vectorize）
 */
export const deleteFile = async (
  bucket: R2Bucket,
  vectorize: VectorizeIndex,
  key: string,
): Promise<void> => {
  const baseName = key.replace(/\.md$/, "");
  const mdKey = baseName.endsWith(".md") ? baseName : `${baseName}.md`;

  // 1. Markdownファイルを削除
  await bucket.delete(mdKey);
  logger.info("[Delete] Deleted file from R2", { key: mdKey });

  // 2. 元ファイル（originals/）を検索して削除
  const listed = await bucket.list({ prefix: `originals/${baseName}` });
  for (const obj of listed.objects) {
    const objBaseName = extractBaseName(obj.key);
    if (objBaseName === baseName) {
      await bucket.delete(obj.key);
      logger.info("[Delete] Deleted original from R2", { key: obj.key });
    }
  }

  // 3. Vectorize から削除
  await deleteKnowledgeBySource(vectorize, mdKey);
  logger.info("[Delete] Deleted from Vectorize", { key: mdKey });
};

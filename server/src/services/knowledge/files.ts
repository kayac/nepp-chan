import { logger } from "~/lib/logger";
import { extractBaseName, markdownBaseName } from "./utils";

export type FileInfo = {
  key: string;
  size: number;
  lastModified: string;
};

export type FileContent = {
  key: string;
  content: string;
  contentType: string;
  size: number;
  lastModified: string;
};

type ListFilesOptions = {
  prefix?: string;
  limit: number;
  cursor?: string;
};

export const listFiles = async (
  bucket: R2Bucket,
  { prefix, limit, cursor }: ListFilesOptions,
) => {
  const listed = await bucket.list({ prefix, limit, cursor });
  const files: FileInfo[] = listed.objects.map((obj) => ({
    key: obj.key,
    size: obj.size,
    lastModified: obj.uploaded.toISOString(),
  }));

  return {
    files,
    nextCursor: listed.truncated ? listed.cursor : null,
    hasMore: listed.truncated,
  };
};

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

export const deleteFile = async (bucket: R2Bucket, key: string) => {
  const baseName = markdownBaseName(key);
  const mdKey = `${baseName}.md`;

  await bucket.delete(mdKey);
  logger.info(`[Delete] Deleted ${mdKey} from R2`);

  const listed = await bucket.list({ prefix: `originals/${baseName}` });
  for (const obj of listed.objects) {
    const objBaseName = extractBaseName(obj.key);
    if (objBaseName === baseName) {
      await bucket.delete(obj.key);
      logger.info(`[Delete] Deleted ${obj.key} from R2`);
    }
  }
};
